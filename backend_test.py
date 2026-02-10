#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for The State of Play Premium Publication Platform
Testing all endpoints: articles, auth, payments, subscriptions
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any

class StateOfPlayAPITester:
    def __init__(self, base_url="https://premium-reader-11.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.test_user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        
        # Test data
        self.test_email = "test@stateofplay.club"
        self.test_password = "test123"
        self.test_name = "Test User"

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test results"""
        self.tests_run += 1
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status}: {name}")
        if details:
            print(f"   Details: {details}")
        if success:
            self.tests_passed += 1

    def make_request(self, method: str, endpoint: str, data: Dict = None, expected_status: int = 200) -> tuple[bool, Dict]:
        """Make HTTP request and return success status and response"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json() if response.text else {}
            except:
                response_data = {"text": response.text, "status_code": response.status_code}
                
            return success, response_data
            
        except requests.RequestException as e:
            return False, {"error": str(e), "endpoint": endpoint}

    def test_articles_endpoint(self):
        """Test articles listing endpoint"""
        print(f"\n🔍 Testing Articles API...")
        
        # Test general articles listing
        success, response = self.make_request('GET', 'articles')
        self.log_test("GET /api/articles", success, f"Returned {len(response) if isinstance(response, list) else 0} articles")
        
        if success and isinstance(response, list):
            # Test that we have articles
            has_articles = len(response) > 0
            self.log_test("Articles present in database", has_articles, f"Found {len(response)} articles")
            
            if has_articles:
                # Test article structure
                article = response[0]
                required_fields = ['id', 'title', 'content', 'author', 'publication', 'is_premium']
                has_all_fields = all(field in article for field in required_fields)
                self.log_test("Article has required fields", has_all_fields, f"Fields: {list(article.keys())}")
                
                # Test publication filtering
                success, state_articles = self.make_request('GET', 'articles?publication=The State of Play')
                self.log_test("Filter by State of Play publication", success, f"Found {len(state_articles) if success else 0} premium articles")
                
                success, left_field_articles = self.make_request('GET', 'articles?publication=The Left Field')
                self.log_test("Filter by Left Field publication", success, f"Found {len(left_field_articles) if success else 0} free articles")
                
                # Test individual article endpoint
                if response:
                    article_id = response[0]['id']
                    success, single_article = self.make_request('GET', f'articles/{article_id}')
                    self.log_test("GET single article", success, f"Retrieved article: {single_article.get('title', 'Unknown') if success else 'Failed'}")

    def test_auth_signup(self):
        """Test user signup"""
        print(f"\n🔍 Testing Auth Signup...")
        
        # Test signup with new user (using timestamp to avoid conflicts)
        timestamp = int(datetime.now().timestamp())
        signup_email = f"testuser_{timestamp}@stateofplay.club"
        
        signup_data = {
            "email": signup_email,
            "password": "testpass123",
            "name": "Test User"
        }
        
        success, response = self.make_request('POST', 'auth/signup', signup_data)
        self.log_test("POST /api/auth/signup - New User", success, f"User created: {response.get('user', {}).get('name') if success else response.get('detail', 'Unknown error')}")
        
        if success and 'token' in response:
            # Try duplicate signup
            success_dup, response_dup = self.make_request('POST', 'auth/signup', signup_data, expected_status=400)
            self.log_test("Prevent duplicate signup", success_dup, "Correctly rejected duplicate email")

    def test_auth_login(self):
        """Test user login with predefined test user"""
        print(f"\n🔍 Testing Auth Login...")
        
        login_data = {
            "email": self.test_email,
            "password": self.test_password
        }
        
        success, response = self.make_request('POST', 'auth/login', login_data)
        self.log_test("POST /api/auth/login", success, f"Login successful: {response.get('user', {}).get('name') if success else response.get('detail', 'Login failed')}")
        
        if success and 'token' in response:
            self.token = response['token']
            self.test_user_id = response['user']['id']
            
            # Test /auth/me endpoint
            success, me_response = self.make_request('GET', 'auth/me')
            self.log_test("GET /api/auth/me", success, f"User profile: {me_response.get('name') if success else 'Failed'}")
            
        else:
            # Test with invalid credentials
            invalid_data = {"email": self.test_email, "password": "wrongpassword"}
            success_invalid, _ = self.make_request('POST', 'auth/login', invalid_data, expected_status=401)
            self.log_test("Reject invalid credentials", success_invalid, "Correctly rejected invalid login")

    def test_subscription_status(self):
        """Test subscription status endpoint"""
        print(f"\n🔍 Testing Subscription Status...")
        
        if not self.token:
            self.log_test("Subscription status (no auth)", False, "No valid token available")
            return
            
        success, response = self.make_request('GET', 'user/subscription')
        self.log_test("GET /api/user/subscription", success, f"Subscription data: {response if success else 'Failed'}")

    def test_razorpay_order_creation(self):
        """Test Razorpay order creation (mocked)"""
        print(f"\n🔍 Testing Payment Integration...")
        
        if not self.token:
            self.log_test("Payment order creation (no auth)", False, "No valid token available")
            return
            
        order_data = {
            "amount": 99900,  # ₹999 in paise
            "currency": "INR"
        }
        
        success, response = self.make_request('POST', 'payment/create-order', order_data)
        self.log_test("POST /api/payment/create-order", success, f"Order created: {response.get('order_id', 'Failed') if success else response.get('detail', 'Creation failed')}")
        
        if success and 'order_id' in response:
            # Verify order contains required fields
            required_fields = ['order_id', 'amount', 'currency', 'key_id']
            has_all_fields = all(field in response for field in required_fields)
            self.log_test("Payment order has required fields", has_all_fields, f"Fields: {list(response.keys())}")

    def run_all_tests(self):
        """Run comprehensive API tests"""
        print("🚀 Starting Comprehensive Backend API Testing for The State of Play")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 80)
        
        # Test articles (no auth required)
        self.test_articles_endpoint()
        
        # Test authentication
        self.test_auth_signup()
        self.test_auth_login()
        
        # Test authenticated endpoints
        self.test_subscription_status()
        self.test_razorpay_order_creation()
        
        # Print summary
        print("\n" + "=" * 80)
        print(f"📊 TEST SUMMARY")
        print(f"   Total Tests: {self.tests_run}")
        print(f"   Passed: {self.tests_passed}")
        print(f"   Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%" if self.tests_run > 0 else "   Success Rate: 0%")
        print("=" * 80)
        
        return self.tests_passed == self.tests_run

def main():
    tester = StateOfPlayAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())