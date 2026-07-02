"""Session-8 tests: monthly quota + duplicate-nominee abuse prevention on /api/nominations."""
import os
import re
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://preview-polish.preview.emergentagent.com').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

_client = MongoClient(MONGO_URL)
_db = _client[DB_NAME]


def _unique_sub_email():
    return f"TEST_sub_{uuid.uuid4().hex[:8]}@example.com"


def _unique_nom_email():
    return f"TEST_nom_{uuid.uuid4().hex[:8]}@example.com"


def _cleanup(sub_email):
    try:
        _db.story_tokens.delete_many({'subscriber_email': sub_email.lower().strip()})
    except Exception:
        pass


def _submit(sub_email, nom_email, nom_name="Test Nom"):
    return requests.post(
        f"{BASE_URL}/api/nominations/submit",
        json={
            'subscriber_ghost_id': 'ghost_TEST_id',
            'subscriber_name': 'Test Sub',
            'subscriber_email': sub_email,
            'nominee_name': nom_name,
            'nominee_email': nom_email,
            'nominee_context': 'context ok',
        },
        timeout=30,
    )


# ─── /api/nominations/quota ─────────────────────────────────────────────
class TestQuotaEndpoint:
    def test_fresh_subscriber(self):
        email = _unique_sub_email()
        _cleanup(email)
        r = requests.get(f"{BASE_URL}/api/nominations/quota", params={'subscriber_email': email}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d['used'] == 0
        assert d['quota'] == 5
        assert d['remaining'] == 5
        assert isinstance(d['resets_on'], str) and d['resets_on']
        # e.g. "1 August" — day + month
        assert re.match(r"^\d{1,2}\s+[A-Za-z]+$", d['resets_on']), f"resets_on shape unexpected: {d['resets_on']}"

    def test_missing_param(self):
        r = requests.get(f"{BASE_URL}/api/nominations/quota", timeout=15)
        # Either 422 or fail-open remaining:5 is acceptable per spec
        assert r.status_code in (200, 422), r.status_code
        if r.status_code == 200:
            assert r.json().get('remaining') == 5


# ─── /api/nominations/submit — quota + duplicate ────────────────────────
class TestNominationSubmit:
    def test_decrement_quota_5_to_0_then_block(self):
        sub = _unique_sub_email()
        _cleanup(sub)
        try:
            expected_remaining = [4, 3, 2, 1, 0]
            for i, exp in enumerate(expected_remaining, start=1):
                r = _submit(sub, _unique_nom_email(), f"Nominee {i}")
                assert r.status_code == 200
                d = r.json()
                assert d.get('success') is True, f"call {i}: {d}"
                assert d.get('nominations_remaining') == exp, f"call {i}: {d}"
                assert d.get('token_id') and d.get('story_url')
            # 6th call → quota_exceeded, no token row created, no ghost call
            before = _db.story_tokens.count_documents({'subscriber_email': sub.lower(), 'token_type': 'nomination'})
            r6 = _submit(sub, _unique_nom_email(), "Sixth")
            assert r6.status_code == 200
            d6 = r6.json()
            assert d6['success'] is False
            assert d6['error'] == 'quota_exceeded'
            assert d6['nominations_remaining'] == 0
            assert d6['quota'] == 5
            assert isinstance(d6.get('resets_on'), str) and d6['resets_on']
            after = _db.story_tokens.count_documents({'subscriber_email': sub.lower(), 'token_type': 'nomination'})
            assert after == before, "quota_exceeded MUST NOT create a token row"
        finally:
            _cleanup(sub)

    def test_duplicate_nominee_third_time_rejected(self):
        sub = _unique_sub_email()
        nom = _unique_nom_email()
        _cleanup(sub)
        try:
            # first two accepted
            for i in (1, 2):
                r = _submit(sub, nom, f"Same nominee {i}")
                assert r.status_code == 200 and r.json().get('success') is True, r.text
            before = _db.story_tokens.count_documents({'subscriber_email': sub.lower(), 'nominee_email': nom.lower()})
            assert before == 2
            # third should be blocked
            r3 = _submit(sub, nom, "Same nominee 3")
            assert r3.status_code == 200
            d3 = r3.json()
            assert d3['success'] is False, d3
            assert d3['error'] == 'duplicate_nominee'
            assert isinstance(d3['nominations_remaining'], int)
            after = _db.story_tokens.count_documents({'subscriber_email': sub.lower(), 'nominee_email': nom.lower()})
            assert after == 2, "duplicate MUST NOT create a 3rd token row"
        finally:
            _cleanup(sub)

    def test_order_quota_before_duplicate(self):
        # Subscriber over quota, tries to submit a NEW nominee → quota_exceeded not duplicate_nominee
        sub = _unique_sub_email()
        _cleanup(sub)
        try:
            # Pre-seed 5 docs directly in Mongo
            now = datetime.now(timezone.utc)
            docs = [{
                'token_id': str(uuid.uuid4()),
                'subscriber_email': sub.lower(),
                'nominee_email': f"prev{i}@example.com",
                'token_type': 'nomination',
                'created_at': now,
                'status': 'active',
            } for i in range(5)]
            _db.story_tokens.insert_many(docs)

            r = _submit(sub, _unique_nom_email(), "Fresh Nominee")
            d = r.json()
            assert r.status_code == 200
            assert d['success'] is False
            assert d['error'] == 'quota_exceeded', f"quota check must run first — got: {d}"
        finally:
            _cleanup(sub)

    def test_subscriber_ghost_id_persisted(self):
        sub = _unique_sub_email()
        _cleanup(sub)
        try:
            r = _submit(sub, _unique_nom_email(), "GhostID Test")
            assert r.status_code == 200 and r.json().get('success') is True
            doc = _db.story_tokens.find_one({'subscriber_email': sub.lower(), 'token_type': 'nomination'})
            assert doc is not None
            assert 'subscriber_ghost_id' in doc, f"doc keys: {list(doc.keys())}"
            assert doc['subscriber_ghost_id'] == 'ghost_TEST_id'
        finally:
            _cleanup(sub)

    def test_case_insensitive_subscriber_email(self):
        # Rule (e): X@ex.com and x@ex.com are the same subscriber for quota purposes.
        sub_upper = f"TEST_UPPER_{uuid.uuid4().hex[:6]}@Example.COM"
        sub_lower = sub_upper.lower()
        _cleanup(sub_lower)
        try:
            r1 = _submit(sub_upper, _unique_nom_email(), "A")
            assert r1.json().get('success') is True
            # Now with lower-case — quota should reflect the first submission
            r2 = requests.get(f"{BASE_URL}/api/nominations/quota",
                              params={'subscriber_email': sub_lower}, timeout=15)
            assert r2.status_code == 200
            assert r2.json()['used'] == 1, r2.json()
        finally:
            _cleanup(sub_lower)


# ─── token_type isolation: cold-link doesn't count ──────────────────────
class TestTokenTypeIsolation:
    def test_cold_link_does_not_count(self):
        # Insert a cold-link token DIRECTLY (avoids needing ADMIN_KEY env var).
        sub = _unique_sub_email()
        _cleanup(sub)
        try:
            now = datetime.now(timezone.utc)
            _db.story_tokens.insert_one({
                'token_id': str(uuid.uuid4()),
                'subscriber_email': sub.lower(),
                'nominee_email': 'x@example.com',
                'token_type': 'cold-link',
                'created_at': now,
                'status': 'active',
            })
            r = requests.get(f"{BASE_URL}/api/nominations/quota",
                             params={'subscriber_email': sub}, timeout=15)
            d = r.json()
            assert d['used'] == 0, f"cold-link should NOT count toward quota; got {d}"
            assert d['remaining'] == 5
        finally:
            _cleanup(sub)


# ─── Regression: prior test suites still pass ───────────────────────────
class TestRegressionRootHealth:
    def test_backend_root_reachable(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code in (200, 404, 405), r.status_code
