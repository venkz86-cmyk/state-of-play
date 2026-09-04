/**
 * =============================================================================
 * THE STATE OF PLAY - CORPORATE SUBSCRIPTIONS BACKEND
 * =============================================================================
 *
 * Google Apps Script backend for managing corporate team subscriptions.
 * Handles account creation, member management, and Ghost CMS integration.
 *
 * CHANGES IN THIS VERSION (v5):
 * - Added the `list_accounts` action (+ handleListAccounts) for the
 *   internal TSOP admin dashboard's read-only Corporate accounts tab.
 *   Auth reuses the existing RENDER_ADMIN_KEY constant below -- no new
 *   Script Property needed. Every account row is returned EXCEPT
 *   dashboard_token (a per-company bearer credential), plus a computed
 *   member_count.
 * - All other logic unchanged from v4.
 *
 * CHANGES IN v4:
 * - FIX: generateGhostJWT() now passes signatureInput as signed byte[] via
 *   Utilities.newBlob(signatureInput).getBytes() so both arguments to
 *   computeHmacSha256Signature are Byte[] — matching the (Byte[], Byte[])
 *   overload. Passing a plain String as the first arg caused the
 *   "(String, number[]) don't match method signature" error.
 * - FIX: hexToByteArray() now returns signed bytes (-128 to 127) not
 *   unsigned (0–255), which is what Apps Script Byte[] requires.
 * - All other logic unchanged from v3.
 *
 * =============================================================================
 * DEPLOYMENT INSTRUCTIONS
 * =============================================================================
 *
 * 0. BEFORE pasting this in: this file's SLACK_WEBHOOK_URL,
 *    SLACK_VERIFICATION_TOKEN, and RENDER_ADMIN_KEY constants below are
 *    placeholders -- the real values are never committed to git. Copy the
 *    three real values out of your CURRENTLY deployed script (open the
 *    Apps Script editor first, before overwriting anything) and paste them
 *    into this file locally before deploying it. If you've lost track of
 *    any of them: RENDER_ADMIN_KEY is the same value as the backend's
 *    ADMIN_KEY env var on Render; the other two you'll need from wherever
 *    you originally generated them (Slack app settings for both).
 * 1. Open your Apps Script project (Corporate Subs TSOP)
 * 2. Replace entire Code.gs content with this file (with the 3 real
 *    secrets restored, per step 0)
 * 3. Deploy → Manage Deployments → edit the EXISTING deployment → New version
 *    (do not create a brand-new deployment -- that gets a new URL, and
 *    everything else already points at the current one)
 * 4. No new Script Property needed for v5 -- list_accounts reuses
 *    RENDER_ADMIN_KEY below.
 *
 * NOTE ON "FROM" ADDRESS:
 * To send from venkat@stateofplay.club the script owner must have added
 * that address as a Gmail "Send mail as" alias. Otherwise From: will be
 * the script owner's default Gmail address.
 *
 * =============================================================================
 * SCRIPT PROPERTIES REQUIRED
 * =============================================================================
 *
 * Set in Project Settings → Script Properties:
 *   SHEET_ID            — Google Sheet ID (from the URL)
 *   GHOST_ADMIN_API_KEY — Ghost Admin API key (format: "id:secret")
 *
 * =============================================================================
 */

const SHEET_ID = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || 'YOUR_SHEET_ID_HERE';
const ACCOUNTS_SHEET_NAME = 'accounts';
const MEMBERS_SHEET_NAME  = 'members';
const GHOST_URL           = 'https://the-state-of-play.ghost.io';
const GHOST_API_VERSION   = 'v5.0';
const SLACK_WEBHOOK_URL = 'PASTE_YOUR_SLACK_WEBHOOK_URL_HERE'; // real value only in the deployed script, never in git
const NOMINATIONS_SHEET_NAME = 'nominations'
const NOMINATION_COLUMNS = [
  'nomination_date',
  'subscriber_name',
  'subscriber_email',
  'subscriber_ghost_id',
  'nominee_name',
  'nominee_email',
  'nominee_context',
  'status',
  'story_sent',
  'cold_link',
  'sent_date',
  'converted_date',
  'subscriber_notified',
];
const SLACK_VERIFICATION_TOKEN = 'PASTE_YOUR_SLACK_VERIFICATION_TOKEN_HERE'; // real value only in the deployed script, never in git
const RENDER_API_URL = 'https://stateofplay-backend.onrender.com'
const RENDER_ADMIN_KEY = 'PASTE_YOUR_RENDER_ADMIN_KEY_HERE'; // same value as the backend's ADMIN_KEY env var on Render -- real value only in the deployed script, never in git

/**
 * =============================================================================
 * MAIN HANDLERS
 * =============================================================================
 */

/**
 * Handle GET requests — Load dashboard data
 * URL: /exec?token={dashboard_token}
 */
function doGet(e) {
  try {
    const token = e.parameter.token;

    if (!token) {
      return jsonResponse({ success: false, error: 'Missing access token' });
    }

    const account = getAccountByToken(token);
    if (!account) {
      return jsonResponse({ success: false, error: 'Invalid access link' });
    }

    if (account.status !== 'active') {
      return jsonResponse({ success: false, error: 'This subscription is no longer active' });
    }

    // Get members for this account
    const members = getMembers(account.account_id);

    // Enrich each member with Ghost last_seen_at so the dashboard can
    // surface "Active / Dormant / Never signed in" status.
    const lastSeenMap = getGhostLastSeenBatch(members.map(m => m.email));

    return jsonResponse({
      success: true,
      data: {
        account: {
          account_id:     account.account_id,
          company_name:   account.company_name,
          admin_email:    account.admin_email,
          company_domain: account.company_domain,
          plan_name:      account.plan_name,
          seats:          account.seats,
          renewal_date:   account.renewal_date,
          status:         account.status
        },
        members: members.map(m => ({
          member_id:    m.member_id,
          email:        m.email,
          added_at:     m.added_at,
          last_seen_at: lastSeenMap[m.email] || null   // null = never signed in
        }))
      }
    });

  } catch (error) {
    Logger.log('doGet error: ' + error.toString());
    return jsonResponse({ success: false, error: 'An error occurred. Please try again.' });
  }
}

/**
 * Handle POST requests — Create account, add/remove members
 */
function doPost(e) {
  try {
    // ── Slack slash commands arrive as form-encoded, not JSON ──
    if (e.parameter && e.parameter.command) {
      return handleSlackCommand(e.parameter);
    }

    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return jsonResponse({ success: false, error: 'Invalid request format' });
    }

    const action = payload.action;

    switch (action) {
      case 'create_account':  return handleCreateAccount(payload);
      case 'add_member':      return handleAddMember(payload);
      case 'remove_member':   return handleRemoveMember(payload);
      case 'get_account':     return handleGetAccount(payload);
      case 'list_accounts':   return handleListAccounts(payload);
      case 'send_dashboard_link': return handleSendDashboardLink(payload);
      case 'nominate': return handleNominate(payload);
      case 'nomination_submitted': return handleNominationSubmitted(payload);
      case 'nomination_converted': return handleNominationConverted(payload);
      case 'send_login_link': return handleSendLoginLink(payload);
      default:
        return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }

  } catch (error) {
    Logger.log('doPost error: ' + error.toString());
    return jsonResponse({ success: false, error: 'An error occurred. Please try again.' });
  }
}

/**
 * =============================================================================
 * ACTION HANDLERS
 * =============================================================================
 */

/**
 * Create a new corporate account (called by Zapier after payment)
 */
function handleCreateAccount(payload) {
  const requiredFields = ['company_name', 'admin_email', 'plan_name', 'seats', 'amount_paid', 'currency'];
  for (const field of requiredFields) {
    if (!payload[field]) {
      return jsonResponse({ success: false, error: 'Missing required field: ' + field });
    }
  }

  try {
    const sheet          = getAccountsSheet();
    const accountId      = 'ACC' + Date.now();
    const dashboardToken = Utilities.getUuid();
    const adminEmail     = payload.admin_email.toLowerCase().trim();
    const companyDomain  = adminEmail.split('@')[1];
    const createdAt      = new Date().toISOString();
    const renewalDate    = new Date();
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    const renewalDateStr = renewalDate.toISOString().split('T')[0];

    const rowData = [
      accountId,                          // A: account_id
      payload.company_name,               // B: company_name
      adminEmail,                         // C: admin_email
      companyDomain,                      // D: company_domain
      payload.gstin || '',                // E: gstin
      payload.plan_name,                  // F: plan_name
      parseInt(payload.seats),            // G: seats
      parseInt(payload.amount_paid),      // H: amount_paid
      payload.currency,                   // I: currency
      payload.razorpay_payment_id || '',  // J: razorpay_payment_id
      dashboardToken,                     // K: dashboard_token
      createdAt,                          // L: created_at
      renewalDateStr,                     // M: renewal_date
      'active'                            // N: status
    ];

    sheet.appendRow(rowData);
    Logger.log('Created account: ' + accountId + ' for ' + payload.company_name);

    return jsonResponse({
      success: true,
      data: {
        account_id:      accountId,
        dashboard_token: dashboardToken,
        dashboard_url:   'https://www.stateofplay.club/teams/manage?token=' + dashboardToken
      }
    });

  } catch (error) {
    Logger.log('handleCreateAccount error: ' + error.toString());
    return jsonResponse({ success: false, error: 'Failed to create account. Please try again.' });
  }
}

/**
 * Add a team member to an account.
 * Sends a Ghost magic-link invitation email after seat allocation.
 * Magic-link failure is non-fatal — seat is always saved.
 */
function handleAddMember(payload) {
  if (!payload.token) {
    return jsonResponse({ success: false, error: 'Missing access token' });
  }
  if (!payload.email) {
    return jsonResponse({ success: false, error: 'Missing required field: email' });
  }

  try {
    const account = getAccountByToken(payload.token);
    if (!account) {
      return jsonResponse({ success: false, error: 'Invalid access link' });
    }
    if (account.status !== 'active') {
      return jsonResponse({ success: false, error: 'This subscription is no longer active' });
    }

    const email       = payload.email.toLowerCase().trim();
    const emailDomain = email.split('@')[1];

    // STRICT EMAIL VALIDATION - Must match one of the allowed company domains.
// company_domain may be a single domain ("acme.in") OR a comma/whitespace
// separated list ("sportzinteractive.net, marathon-edge.com") for bespoke
// clients with multiple corporate domains.
const allowedDomains = String(account.company_domain || '')
  .toLowerCase()
  .split(/[,\s;]+/)
  .map(function (d) { return d.trim(); })
  .filter(Boolean);
if (allowedDomains.length === 0 || allowedDomains.indexOf(emailDomain) === -1) {
  var domainList = allowedDomains.length > 1
    ? allowedDomains.slice(0, -1).join(', ') + ' or ' + allowedDomains.slice(-1)
    : (allowedDomains[0] || 'the registered company');
  return jsonResponse({
    success: false,
    error: 'Only emails from ' + domainList + ' are allowed'
  });
}

    // Seat limit check
    const currentMembers = getMembers(account.account_id);
    if (currentMembers.length >= account.seats) {
      return jsonResponse({
        success: false,
        error: 'All ' + account.seats + ' seats are filled. Remove a member to add a new one.'
      });
    }

    // Duplicate check (active members only)
    const existingMember = currentMembers.find(m => m.email === email);
    if (existingMember) {
      return jsonResponse({ success: false, error: 'This email is already a team member' });
    }

    // Create Ghost member
    const ghostResult = createGhostMember(email, account.account_id);
    if (!ghostResult.success) {
      return jsonResponse({
        success: false,
        error: ghostResult.error || 'Failed to create member. Please try again.'
      });
    }

    const memberId = 'MEM' + Date.now();
    const addedAt  = new Date().toISOString().split('T')[0];

    getMembersSheet().appendRow([
      memberId,                    // A: member_id
      account.account_id,          // B: account_id
      email,                       // C: email
      ghostResult.ghost_member_id, // D: ghost_member_id
      addedAt,                     // E: added_at
      'active'                     // F: status
    ]);

    Logger.log('Added member: ' + email + ' to account ' + account.account_id);

    // Send magic-link invitation — failure is non-fatal
    const mailResult = sendMagicLinkInvitation({
      memberEmail:   email,
      ghostMemberId: ghostResult.ghost_member_id,
      companyName:   account.company_name,
      adminEmail:    account.admin_email,
    });
    if (!mailResult.success) {
      Logger.log('Magic-link send failed for ' + email + ': ' + mailResult.error);
    }

    return jsonResponse({
      success: true,
      data: {
        member_id:       memberId,
        email:           email,
        invitation_sent: !!mailResult.success
      }
    });

  } catch (error) {
    Logger.log('handleAddMember error: ' + error.toString());
    return jsonResponse({ success: false, error: 'Failed to add member. Please try again.' });
  }
}

/**
 * Remove a team member from an account.
 * Marks the row as "removed" (kept for audit trail) and deletes from Ghost.
 */
function handleRemoveMember(payload) {
  if (!payload.token) {
    return jsonResponse({ success: false, error: 'Missing access token' });
  }
  if (!payload.member_id) {
    return jsonResponse({ success: false, error: 'Missing required field: member_id' });
  }

  try {
    const account = getAccountByToken(payload.token);
    if (!account) {
      return jsonResponse({ success: false, error: 'Invalid access link' });
    }

    const membersSheet = getMembersSheet();
    const data         = membersSheet.getDataRange().getValues();
    const headers      = data[0];

    const memberIdCol      = headers.indexOf('member_id');
    const accountIdCol     = headers.indexOf('account_id');
    const ghostMemberIdCol = headers.indexOf('ghost_member_id');
    const statusCol        = headers.indexOf('status');

    let memberRow  = -1;
    let memberData = null;

    for (let i = 1; i < data.length; i++) {
      if (data[i][memberIdCol] === payload.member_id) {
        if (data[i][accountIdCol] !== account.account_id) {
          return jsonResponse({ success: false, error: 'Member not found in this account' });
        }
        memberRow  = i + 1; // Sheets are 1-indexed
        memberData = data[i];
        break;
      }
    }

    if (memberRow === -1) {
      return jsonResponse({ success: false, error: 'Member not found' });
    }

    // Delete from Ghost (non-fatal if it fails)
    const ghostMemberId = memberData[ghostMemberIdCol];
    if (ghostMemberId) {
      const deleteResult = deleteGhostMember(ghostMemberId);
      if (!deleteResult.success) {
        Logger.log('Warning: Failed to delete Ghost member: ' + deleteResult.error);
      }
    }

    // Mark as removed (keep row for audit trail)
    membersSheet.getRange(memberRow, statusCol + 1).setValue('removed');
    Logger.log('Removed member: ' + payload.member_id + ' from account ' + account.account_id);

    return jsonResponse({
      success: true,
      data: { member_id: payload.member_id }
    });

  } catch (error) {
    Logger.log('handleRemoveMember error: ' + error.toString());
    return jsonResponse({ success: false, error: 'Failed to remove member. Please try again.' });
  }
}

/**
 * Get account data via POST (alternative to GET)
 */
function handleGetAccount(payload) {
  if (!payload.token) {
    return jsonResponse({ success: false, error: 'Missing access token' });
  }

  const account = getAccountByToken(payload.token);
  if (!account) {
    return jsonResponse({ success: false, error: 'Invalid access link' });
  }
  if (account.status !== 'active') {
    return jsonResponse({ success: false, error: 'This subscription is no longer active' });
  }

  const members     = getMembers(account.account_id);
  const lastSeenMap = getGhostLastSeenBatch(members.map(m => m.email));

  return jsonResponse({
    success: true,
    data: {
      account: {
        account_id:     account.account_id,
        company_name:   account.company_name,
        admin_email:    account.admin_email,
        company_domain: account.company_domain,
        plan_name:      account.plan_name,
        seats:          account.seats,
        renewal_date:   account.renewal_date,
        status:         account.status
      },
      members: members.map(m => ({
        member_id:    m.member_id,
        email:        m.email,
        added_at:     m.added_at,
        last_seen_at: lastSeenMap[m.email] || null
      }))
    }
  });
}

/**
 * List every corporate account (admin-only) for the internal TSOP admin
 * dashboard. Unlike every other handler here, this isn't scoped by a
 * per-company dashboard_token -- it returns every company's row -- so it
 * checks a shared secret instead: the same RENDER_ADMIN_KEY this script
 * already uses (see runNominationAccessExpiryCheck / handleSlackApprove)
 * to authenticate itself to the Render backend -- no new Script Property.
 *
 * dashboard_token is deliberately stripped from every row before
 * returning -- it's a per-company bearer credential, not something an
 * admin list view should ever expose. member_count is computed per
 * account the same way doGet/handleGetAccount already do for one company.
 */
function handleListAccounts(payload) {
  if (!RENDER_ADMIN_KEY || payload.admin_key !== RENDER_ADMIN_KEY) {
    return jsonResponse({ success: false, error: 'Unauthorized' });
  }

  try {
    const sheet = getAccountsSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const accountIdCol = headers.indexOf('account_id');

    const accounts = [];
    for (let i = 1; i < data.length; i++) {
      if (!data[i][accountIdCol]) continue; // skip a stray blank row
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      delete row.dashboard_token;
      row.member_count = getMembers(row.account_id).length;
      accounts.push(row);
    }

    return jsonResponse({ success: true, data: { accounts: accounts } });

  } catch (error) {
    Logger.log('handleListAccounts error: ' + error.toString());
    return jsonResponse({ success: false, error: 'Failed to list accounts. Please try again.' });
  }
}

/**
 * =============================================================================
 * NOMINATIONS — reader-to-reader forwards
 * =============================================================================
 *
 * Fired by FastAPI at /api/nominations/submit. Handles three side effects:
 *   1. Append a row to the "Nominations" tab in the Google Sheet
 *   2. Email the nominee from venkat@stateofplay.club (Gmail alias)
 *   3. Ping #state-of-play-ops on Slack
 *
 * All three are best-effort — a failure in one MUST NOT prevent the others.
 * FastAPI treats this webhook as fire-and-forget, so we always return 200.
 *
 * Expected payload keys (some are aliased for backwards-compat):
 *   subscriber_name, subscriber_email
 *   nominee_name, nominee_email
 *   nominee_context   (canonical) | personal_note (accepted alias)
 *   post_slug
 *   token_id
 *   story_url         (canonical) | token_url    (accepted alias)
 */
function handleNominationSubmitted(payload) {
  try {
    var subscriberName  = (payload.subscriber_name  || '').toString().trim();
    var subscriberEmail = (payload.subscriber_email || '').toString().trim();
    var nomineeName     = (payload.nominee_name     || '').toString().trim();
    var nomineeEmail    = (payload.nominee_email    || '').toString().trim();
    var note            = (payload.nominee_context  || payload.personal_note || '').toString().trim();
    var postSlug        = (payload.post_slug        || '').toString().trim();
    var tokenId         = (payload.token_id         || '').toString().trim();
    var storyUrl        = (payload.story_url        || payload.token_url      || '').toString().trim();

    // Validate the two fields we cannot recover from missing.
    if (!nomineeEmail || !tokenId) {
      Logger.log('nomination_submitted: missing nomineeEmail or tokenId — aborting');
      return jsonResponse({ success: false, error: 'Missing nominee_email or token_id' });
    }

    // Rebuild the story URL if the backend didn't send one (defence-in-depth).
    if (!storyUrl) storyUrl = 'https://www.stateofplay.club/s/' + tokenId;

    var subscriberFirst = subscriberName.split(' ')[0] || 'A State of Play reader';

    // ── 1. Sheet row ──────────────────────────────────────────────────────
    try {
      appendNominationRow_({
        subscriberName:  subscriberName,
        subscriberEmail: subscriberEmail,
        nomineeName:     nomineeName,
        nomineeEmail:    nomineeEmail,
        note:            note,
        postSlug:        postSlug,
        storyUrl:        storyUrl,
      });
    } catch (sheetErr) {
      Logger.log('nomination sheet append failed: ' + sheetErr.toString());
    }

    // ── 2. Email the nominee ──────────────────────────────────────────────
    // As of Sept 2026 the backend sends this email itself, via Resend
    // (nominations.py's welcome-email send, right after it grants the
    // 14-day access window) — this script's own sendNominationEmail_()
    // is now stale copy and would double-send if called here. Left
    // defined below for _testEmailOnly(), just no longer invoked live.

    // ── 3. Slack ping ─────────────────────────────────────────────────────
    try {
      postNominationToSlack_({
        subscriberName:  subscriberName || '(unknown)',
        subscriberEmail: subscriberEmail || '(unknown)',
        nomineeName:     nomineeName || '(unknown)',
        nomineeEmail:    nomineeEmail,
        postSlug:        postSlug || '(none)',
        note:            note || '(none)',
        storyUrl:        storyUrl,
      });
    } catch (slackErr) {
      Logger.log('nomination slack ping failed: ' + slackErr.toString());
    }

    return jsonResponse({ success: true, token_id: tokenId });

  } catch (err) {
    Logger.log('handleNominationSubmitted error: ' + err.toString());
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Append one row to the "Nominations" tab. Creates the tab + header row
 * on first run so you don't have to hand-provision it.
 */
function appendNominationRow_(d) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('Nominations');
  if (!sheet) {
    sheet = ss.insertSheet('Nominations');
    sheet.appendRow([
      'Date',
      'Subscriber name',
      'Subscriber email',
      'Nominee name',
      'Nominee email',
      'Note',
      'Post slug',
      'Token URL',
      'Status',
    ]);
    // Bold the header row + freeze it.
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    new Date(),
    d.subscriberName,
    d.subscriberEmail,
    d.nomineeName,
    d.nomineeEmail,
    d.note,
    d.postSlug,
    d.storyUrl,
    'Pending',
  ]);
}

/**
 * Send the nominee email. Subject: "[Subscriber first name] thought you
 * should read this". Format mirrors the corporate magic-link mail styling.
 */
function sendNominationEmail_(d) {
  var subject = d.subscriberFirst + ' thought you should read this';
  var nomineeFirst = (d.nomineeName.split(' ')[0]) || 'there';

  var textBody =
    'Hi ' + nomineeFirst + ',\n\n' +
    d.subscriberName + ' just forwarded you a piece from The State of Play.\n\n' +
    (d.note ? '"' + d.note + '"\n\n— ' + d.subscriberName + '\n\n' : '') +
    'Read it here (no paywall, no signup needed):\n' + d.storyUrl + '\n\n' +
    'The State of Play is a reader-supported publication on the business of Indian sport. ' +
    'Reported intelligence, no aggregation. If it lands, you can subscribe at ' +
    'https://www.stateofplay.club?ref=shared-story.\n\n' +
    'Venkat\n' +
    'Editor, The State of Play\n' +
    '—\nLeft Field Ventures · Ground Floor, 36 Infantry Road, Bengaluru 560001';

  var htmlBody =
    '<div style="font-family: Georgia, \'Times New Roman\', serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">' +
    '<p style="font-family: -apple-system, sans-serif; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">— The State of Play —</p>' +
    '<h1 style="font-size: 28px; font-weight: 600; line-height: 1.15; margin: 0 0 20px;">Hi ' + nomineeFirst + ',</h1>' +
    '<p><strong>' + d.subscriberName + '</strong> just forwarded you a piece from The State of Play.</p>' +
    (d.note
      ? '<blockquote style="border-left: 3px solid #A0291C; margin: 24px 0; padding: 4px 0 4px 18px; font-style: italic; color: #333333;">' +
        '“' + d.note.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '”<br>' +
        '<span style="font-style: normal; font-size: 14px; color: #666666;">— ' + d.subscriberName + '</span>' +
        '</blockquote>'
      : '') +
    '<p style="margin: 32px 0;"><a href="' + d.storyUrl + '" style="display: inline-block; background: #A0291C; color: #FFFFFF; padding: 14px 28px; text-decoration: none; font-family: -apple-system, sans-serif; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500;">Read the story →</a></p>' +
    '<p style="font-family: -apple-system, sans-serif; font-size: 13px; color: #666666;">Or paste this into your browser:<br><span style="color: #A0291C; word-break: break-all;">' + d.storyUrl + '</span></p>' +
    '<p>No paywall on this one, no signup needed. Read as much as you like.</p>' +
    '<p style="color: #555555;">The State of Play is a reader-supported publication on the business of Indian sport. Reported intelligence, no aggregation. If it lands, you can subscribe at <a href="https://www.stateofplay.club?ref=shared-story" style="color: #A0291C;">stateofplay.club</a>.</p>' +
    '<p style="margin-top: 32px;">Venkat<br><span style="font-family: -apple-system, sans-serif; font-size: 13px; color: #666666;">Editor, The State of Play</span></p>' +
    '<hr style="border: 0; border-top: 1px solid #E5E2DC; margin: 32px 0 16px;">' +
    '<p style="font-family: -apple-system, sans-serif; font-size: 12px; color: #999999; line-height: 1.7;">Left Field Ventures · Ground Floor, 36 Infantry Road, Bengaluru 560001</p>' +
    '</div>';

  // To send FROM venkat@stateofplay.club, that address must be a
  // "Send mail as" alias on the script owner's Gmail account. Otherwise
  // Gmail will silently fall back to the owner's default address.
  MailApp.sendEmail({
    to: d.nomineeEmail,
    subject: subject,
    htmlBody: htmlBody,
    body: textBody,
    from: 'venkat@stateofplay.club',
    name: 'Venkat Ananth · The State of Play',
    replyTo: 'venkat@stateofplay.club',
  });

  Logger.log('Nomination email sent to ' + d.nomineeEmail);
}

/**
 * Post the nomination to #state-of-play-ops. Uses a Script Property
 * called SLACK_WEBHOOK_URL so you can rotate it without redeploying.
 */
function postNominationToSlack_(d) {
  var webhook = PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL');
  if (!webhook) {
    Logger.log('SLACK_WEBHOOK_URL not configured — skipping Slack ping');
    return;
  }

  var text =
    '*NEW NOMINATION*\n' +
    'From: ' + d.subscriberName + ' (' + d.subscriberEmail + ')\n' +
    'Nominee: ' + d.nomineeName + ' (' + d.nomineeEmail + ')\n' +
    'Story: ' + d.postSlug + '\n' +
    'Note: ' + d.note + '\n' +
    'Link: ' + d.storyUrl;

  UrlFetchApp.fetch(webhook, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ text: text }),
    muteHttpExceptions: true,
  });
}
/**
 * =============================================================================
 * HELPER FUNCTIONS — DATA ACCESS
 * =============================================================================
 */

function getAccountsSheet() {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(ACCOUNTS_SHEET_NAME);
}

function getMembersSheet() {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(MEMBERS_SHEET_NAME);
}

/**
 * Find an account by its dashboard token.
 * Returns account object or null if not found.
 */
function getAccountByToken(token) {
  const sheet    = getAccountsSheet();
  const data     = sheet.getDataRange().getValues();
  const headers  = data[0];
  const tokenCol = headers.indexOf('dashboard_token');

  if (tokenCol === -1) {
    Logger.log('Error: dashboard_token column not found');
    return null;
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][tokenCol] === token) {
      const account = {};
      for (let j = 0; j < headers.length; j++) {
        account[headers[j]] = data[i][j];
      }
      account.seats = parseInt(account.seats) || 0;
      return account;
    }
  }
  return null;
}

/**
 * Get all active members for an account.
 */
function getMembers(accountId) {
  const sheet        = getMembersSheet();
  const data         = sheet.getDataRange().getValues();
  const headers      = data[0];
  const members      = [];
  const accountIdCol = headers.indexOf('account_id');
  const statusCol    = headers.indexOf('status');

  for (let i = 1; i < data.length; i++) {
    if (data[i][accountIdCol] === accountId && data[i][statusCol] === 'active') {
      const member = {};
      for (let j = 0; j < headers.length; j++) {
        member[headers[j]] = data[i][j];
      }
      members.push(member);
    }
  }
  return members;
}

/**
 * =============================================================================
 * HELPER FUNCTIONS — GHOST API
 * =============================================================================
 */

/**
 * Generate a signed JWT for Ghost Admin API authentication (HS256).
 *
 * FIX (v4): computeHmacSha256Signature requires (Byte[], Byte[]).
 * Convert signatureInput to a signed byte array via Utilities.newBlob().getBytes()
 * so both arguments match the Byte[] overload.
 * hexToByteArray() returns signed bytes (-128 to 127) as required.
 */
function generateGhostJWT() {
  const apiKey = PropertiesService.getScriptProperties()
    .getProperty('GHOST_ADMIN_API_KEY');

  if (!apiKey || !apiKey.includes(':')) {
    Logger.log('Error: GHOST_ADMIN_API_KEY not configured or invalid format');
    return null;
  }

  const [id, secret] = apiKey.split(':');
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 300; // 5-minute expiry

  const header  = { alg: 'HS256', typ: 'JWT', kid: id };
  const payload = { iat, exp, aud: '/admin/' };

  const encodedHeader  = Utilities.base64EncodeWebSafe(
    JSON.stringify(header)).replace(/=+$/, '');
  const encodedPayload = Utilities.base64EncodeWebSafe(
    JSON.stringify(payload)).replace(/=+$/, '');

  const signatureInput = encodedHeader + '.' + encodedPayload;

  // Both args must be Byte[] (signed number[]).
  // Convert the string to bytes via a Blob; convert the hex secret via hexToByteArray.
  const sigBytes = Utilities.computeHmacSha256Signature(
    Utilities.newBlob(signatureInput).getBytes(),
    hexToByteArray(secret)
  );

  const encodedSignature = Utilities.base64EncodeWebSafe(sigBytes)
    .replace(/=+$/, '');

  return encodedHeader + '.' + encodedPayload + '.' + encodedSignature;
}

/**
 * Convert a hex string to a signed byte array (-128 to 127).
 * Apps Script's Byte[] is signed — values above 127 must wrap to negative.
 */
function hexToByteArray(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    let b = parseInt(hex.substr(i, 2), 16);
    if (b > 127) b -= 256; // unsigned → signed
    bytes.push(b);
  }
  return bytes;
}

/**
 * Create a member in Ghost CMS.
 * Returns: { success: true, ghost_member_id: "..." }
 *       or { success: false, error: "..." }
 */
function createGhostMember(email, accountId) {
  try {
    const token = generateGhostJWT();
    if (!token) return { success: false, error: 'Ghost API not configured' };

    const url     = GHOST_URL + '/ghost/api/admin/members/?send_email=false';
    const payload = {
      members: [{
        email:  email,
        labels: [
          { name: 'corporate-member' },
          { name: 'corp-' + accountId }
        ]
      }]
    };

    const options = {
      method:  'POST',
      headers: {
        'Authorization': 'Ghost ' + token,
        'Content-Type':  'application/json'
      },
      payload:            JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response     = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    Logger.log('Ghost create member response: ' + responseCode + ' - ' + responseBody);

    if (responseCode === 201 || responseCode === 200) {
      const data = JSON.parse(responseBody);
      return { success: true, ghost_member_id: data.members[0].id };
    } else if (responseCode === 422) {
      const data = JSON.parse(responseBody);
      if (data.errors && data.errors[0] &&
    (data.errors[0].message.includes('already exists') ||
     (data.errors[0].context && data.errors[0].context.includes('already exists')))) {
        const existingMember = findGhostMemberByEmail(email);
        if (existingMember) {
          return { success: true, ghost_member_id: existingMember.id };
        }
      }
      return { success: false, error: 'This email is already registered' };
    } else {
      Logger.log('Ghost API error: ' + responseBody);
      return { success: false, error: 'Failed to create member in Ghost' };
    }

  } catch (error) {
    Logger.log('createGhostMember error: ' + error.toString());
    return { success: false, error: 'Failed to create member. Please try again.' };
  }
}

/**
 * Find a Ghost member by email address.
 */
function findGhostMemberByEmail(email) {
  try {
    const token = generateGhostJWT();
    if (!token) return null;

    const url = GHOST_URL + '/ghost/api/admin/members/?filter=email:' +
      encodeURIComponent(email);
    const options = {
      method:  'GET',
      headers: { 'Authorization': 'Ghost ' + token },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      if (data.members && data.members.length > 0) return data.members[0];
    }
    return null;

  } catch (error) {
    Logger.log('findGhostMemberByEmail error: ' + error.toString());
    return null;
  }
}

/**
 * Delete a member from Ghost CMS.
 * Returns: { success: true } or { success: false, error: "..." }
 */
function deleteGhostMember(ghostMemberId) {
  try {
    const token = generateGhostJWT();
    if (!token) return { success: false, error: 'Ghost API not configured' };

    const url     = GHOST_URL + '/ghost/api/admin/members/' + ghostMemberId + '/';
    const options = {
      method:  'DELETE',
      headers: { 'Authorization': 'Ghost ' + token },
      muteHttpExceptions: true
    };

    const response     = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    Logger.log('Ghost delete member response: ' + responseCode);

    // 204 = deleted, 404 = already gone — both acceptable
    if (responseCode === 204 || responseCode === 200 || responseCode === 404) {
      return { success: true };
    } else {
      Logger.log('Ghost delete error: ' + response.getContentText());
      return { success: false, error: 'Failed to delete member from Ghost' };
    }

  } catch (error) {
    Logger.log('deleteGhostMember error: ' + error.toString());
    return { success: false, error: 'Failed to delete member. Please try again.' };
  }
}

/**
 * =============================================================================
 * GHOST LAST-SEEN + MAGIC-LINK HELPERS
 * =============================================================================
 */

/**
 * Fetch Ghost last_seen_at for a batch of member emails in one API call.
 *
 * Uses Ghost NQL filter: email:['a@x.com','b@y.com',...]
 * Returns: { "email@x.com": "2026-04-12T08:14:00.000Z" | null }
 * Failures are silent — dashboard falls back to null ("no status").
 */
function getGhostLastSeenBatch(emails) {
  const out = {};
  if (!emails || emails.length === 0) return out;

  // Initialise all to null
  emails.forEach(function(e) { out[e.toLowerCase()] = null; });

  try {
    const token = generateGhostJWT();
    if (!token) return out;

    const quoted = emails.map(function(e) { return "'" + e + "'"; }).join(',');
    const filter = 'email:[' + quoted + ']';
    const url    = GHOST_URL + '/ghost/api/admin/members/' +
                   '?filter=' + encodeURIComponent(filter) +
                   '&fields=email,last_seen_at' +
                   '&limit=' + emails.length;

    const response = UrlFetchApp.fetch(url, {
      method:  'GET',
      headers: { 'Authorization': 'Ghost ' + token },
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      (data.members || []).forEach(function(m) {
        out[(m.email || '').toLowerCase()] = m.last_seen_at || null;
      });
    } else {
      Logger.log('getGhostLastSeenBatch HTTP ' + response.getResponseCode() +
        ': ' + response.getContentText());
    }
  } catch (err) {
    Logger.log('getGhostLastSeenBatch error: ' + err.toString());
  }

  return out;
}

/**
 * Mint a Ghost one-time signin URL and send an editorial invitation email.
 *
 * Ghost Admin API: GET /ghost/api/admin/members/{id}/signin_urls/
 * Email is sent via Apps Script MailApp — matches TSOP design system
 * (burgundy #A0291C CTA, Fraunces headline, DM Sans body).
 *
 * @param {object} opts
 *   memberEmail   {string} — recipient email
 *   ghostMemberId {string} — Ghost internal member ID
 *   companyName   {string} — used in subject and body
 *   adminEmail    {string} — shown as "X at CompanyName added you"
 *
 * @returns {{ success: boolean, error?: string }}
 */
function sendMagicLinkInvitation(opts) {
  var memberEmail = opts.memberEmail;
  var companyName = opts.companyName || 'your team';
  var adminEmail  = opts.adminEmail  || '';

  try {
    var firstName = (memberEmail.split('@')[0] || '').split(/[._-]/)[0];
    firstName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : 'there';

    var subject = companyName + ' has added you to The State of Play';
    var signinUrl = 'https://www.stateofplay.club/login';

    var textBody =
      'Hi ' + firstName + ',\n\n' +
      (adminEmail ? adminEmail + ' at ' + companyName : companyName) +
      ' has added you to your team’s State of Play subscription. ' +
      'You now have full access to everything we publish: long-reads, ' +
      'the twice-weekly Left Field briefing, and subscriber-only notes (coming soon).\n\n' +
      'To sign in, go to ' + signinUrl + ' and enter your work email (' + memberEmail + '). ' +
      'No password — the site verifies you against your company’s account.\n\n' +
      'If you weren’t expecting this, or you’re not the right person at ' + companyName + ', write to prerna@stateofplay.club and we’ll sort it out.\n\n' +
      'Welcome aboard.\n\n' +
      'Venkat\nEditor, The State of Play\n' +
      '—\nLeft Field Ventures · Ground Floor, 36 Infantry Road, Bengaluru 560001';

    var htmlBody =
      '<div style="font-family: Georgia, \'Times New Roman\', serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">' +

        '<p style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">' +
          '— The State of Play —' +
        '</p>' +

        '<h1 style="font-size: 28px; font-weight: 600; line-height: 1.15; margin: 0 0 24px;">' +
          'You’re in, <em style="font-weight: normal;">' + firstName + '.</em>' +
        '</h1>' +

        '<p><strong>' + (adminEmail || companyName) + '</strong>' + (adminEmail ? ' at ' + companyName : '') + ' has added you to your team’s State of Play subscription. You now have full access to everything we publish, including subscriber-only notes coming soon.</p>' +

        '<p style="margin: 32px 0;">' +
          '<a href="' + signinUrl + '" style="display: inline-block; background: #A0291C; color: #FFFFFF; padding: 14px 28px; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500;">' +
            'Sign in to read →' +
          '</a>' +
        '</p>' +

        '<p style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 13px; color: #666666;">' +
          'Or visit ' +
          '<a href="' + signinUrl + '" style="color: #A0291C;">stateofplay.club/login</a>' +
          ' and enter <strong style="color: #1A1A1A;">' + memberEmail + '</strong>. No password — your access is tied to your company account.' +
        '</p>' +

        '<p>Start with the long-reads at ' +
          '<a href="https://www.stateofplay.club/state-of-play" style="color: #A0291C;">The State of Play</a>' +
          ', or the twice-weekly briefing at ' +
          '<a href="https://www.stateofplay.club/left-field" style="color: #A0291C;">The Left Field</a>.' +
        '</p>' +

        '<p style="color: #555555;">' +
          'If you weren’t expecting this, or you’re not the right person at ' + companyName + ', write to ' +
          '<a href="mailto:prerna@stateofplay.club" style="color: #A0291C;">prerna@stateofplay.club</a> and we’ll sort it out.' +
        '</p>' +

        '<p>Welcome aboard.</p>' +

        '<p style="margin-top: 32px;">' +
          'Venkat<br>' +
          '<span style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 13px; color: #666666;">' +
            'Editor, The State of Play' +
          '</span>' +
        '</p>' +

        '<hr style="border: 0; border-top: 1px solid #E5E2DC; margin: 32px 0 16px;">' +

        '<p style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 12px; color: #999999; line-height: 1.7;">' +
          'Left Field Ventures · Ground Floor, 36 Infantry Road, Bengaluru 560001<br>' +
          'For anything you need on this account, write to ' +
          '<a href="mailto:prerna@stateofplay.club" style="color: #A0291C;">prerna@stateofplay.club</a>.' +
        '</p>' +
      '</div>';

    MailApp.sendEmail({
      to:      memberEmail,
      subject: subject,
      htmlBody: htmlBody,
      body:    textBody,
      name:    'Venkat Ananth · The State of Play',
      replyTo: 'prerna@stateofplay.club',
    });

    Logger.log('Welcome email sent to ' + memberEmail);
    return { success: true };

  } catch (err) {
    Logger.log('sendMagicLinkInvitation error: ' + err.toString());
    return { success: false, error: err.toString() };
  }
}
/**
 * POST { action: "send_login_link", email, login_url }
 *
 * The backend computes login_url fully-formed (token already embedded,
 * pointing at stateofplay.club/login/verify) — this function's only job
 * is sending the email. It never sees or needs to know how the token
 * was generated.
 */
function handleSendLoginLink(payload) {
  if (!payload.email || !payload.login_url) {
    return jsonResponse({ success: false, error: 'Missing email or login_url' });
  }
  try {
    sendLoginLinkEmail(payload.email, payload.login_url);
    return jsonResponse({ success: true });
  } catch (err) {
    Logger.log('handleSendLoginLink error: ' + err.toString());
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function sendLoginLinkEmail(email, loginUrl) {
  var subject = 'Sign in to The State of Play';

  var textBody =
    'Hi,\n\n' +
    'Click below to sign in to The State of Play. This link is single-use ' +
    'and expires in 15 minutes.\n\n' +
    loginUrl + '\n\n' +
    'If you didn’t request this, you can ignore the email — the link ' +
    'simply won’t be used.\n\n' +
    'Venkat\nEditor, The State of Play\n' +
    '—\nLeft Field Ventures · Ground Floor, 36 Infantry Road, Bengaluru 560001';

    var htmlBody =
    '<div style="font-family: \'Schibsted Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">' +
      '<p style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">' +
        '— The State of Play —' +
      '</p>' +
      '<h1 style="font-family: Gloock, \'Playfair Display\', Georgia, serif; font-weight: 400; font-size: 28px; line-height: 1.15; margin: 0 0 24px;">' +
        'Sign in to <em style="font-style: italic;">read.</em>' +
      '</h1>' +
      '<p>Click below to sign in. This link is single-use and expires in 15 minutes.</p>' +
      '<p style="margin: 32px 0;">' +
        '<a href="' + loginUrl + '" style="display: inline-block; background: #A0291C; color: #FFFFFF; padding: 14px 28px; text-decoration: none; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500;">' +
          'Sign in →' +
        '</a>' +
      '</p>' +
      '<p style="color: #555555;">' +
        'If you didn’t request this, you can safely ignore this email — the link simply won’t be used.' +
      '</p>' +
      '<p style="margin-top: 32px;">' +
        'Venkat<br>' +
        '<span style="font-size: 13px; color: #666666;">' +
          'Editor, The State of Play' +
        '</span>' +
      '</p>' +
      '<hr style="border: 0; border-top: 1px solid #E5E2DC; margin: 32px 0 16px;">' +
      '<p style="font-size: 12px; color: #999999; line-height: 1.7;">' +
        'Left Field Ventures · Ground Floor, 36 Infantry Road, Bengaluru 560001' +
      '</p>' +
    '</div>';
  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: htmlBody,
    body: textBody,
    name: 'Venkat Ananth · The State of Play',
    replyTo: 'prerna@stateofplay.club',
  });

  // Deliberately not logging loginUrl — it carries the live token.
  Logger.log('Login link sent to ' + email);
}
/**
 * =============================================================================
 * UTILITY FUNCTIONS
 * =============================================================================
 */

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * =============================================================================
 * TEST FUNCTIONS (run manually to verify setup)
 * =============================================================================
 */
function handleSendDashboardLink(payload) {
  if (!payload.email) {
    return jsonResponse({ success: false, error: 'Missing email' });
  }

  const email = payload.email.toLowerCase().trim();

  try {
    // Check accounts sheet (admin_email)
    const accountsSheet = getAccountsSheet();
    const accountsData  = accountsSheet.getDataRange().getValues();
    const accountHeaders = accountsData[0];
    const adminEmailCol  = accountHeaders.indexOf('admin_email');
    const tokenCol       = accountHeaders.indexOf('dashboard_token');
    const statusCol      = accountHeaders.indexOf('status');
    const companyCol     = accountHeaders.indexOf('company_name');

    for (let i = 1; i < accountsData.length; i++) {
      if (accountsData[i][adminEmailCol] === email &&
          accountsData[i][statusCol] === 'active') {
        const token       = accountsData[i][tokenCol];
        const companyName = accountsData[i][companyCol];
        const dashboardUrl = 'https://www.stateofplay.club/teams/manage?token=' + token;
        sendDashboardLinkEmail(email, companyName, dashboardUrl);
        return jsonResponse({ success: true });
      }
    }

    // Check members sheet
    const membersSheet  = getMembersSheet();
    const membersData   = membersSheet.getDataRange().getValues();
    const memberHeaders = membersData[0];
    const memberEmailCol   = memberHeaders.indexOf('email');
    const memberAccountCol = memberHeaders.indexOf('account_id');
    const memberStatusCol  = memberHeaders.indexOf('status');

    for (let i = 1; i < membersData.length; i++) {
      if (membersData[i][memberEmailCol] === email &&
          membersData[i][memberStatusCol] === 'active') {
        const accountId = membersData[i][memberAccountCol];
        // Look up the account to get its token
        for (let j = 1; j < accountsData.length; j++) {
          const accIdCol = accountHeaders.indexOf('account_id');
          if (accountsData[j][accIdCol] === accountId &&
              accountsData[j][statusCol] === 'active') {
            const token        = accountsData[j][tokenCol];
            const companyName  = accountsData[j][companyCol];
            const dashboardUrl = 'https://www.stateofplay.club/teams/manage?token=' + token;
            sendDashboardLinkEmail(email, companyName, dashboardUrl);
            return jsonResponse({ success: true });
          }
        }
      }
    }

    // No match — return success anyway (don't reveal whether email exists)
    return jsonResponse({ success: true });

  } catch (err) {
    Logger.log('handleSendDashboardLink error: ' + err.toString());
    return jsonResponse({ success: true }); // always success-facing
  }
}

function sendDashboardLinkEmail(email, companyName, dashboardUrl) {
  const subject  = 'Your State of Play team dashboard';

  const textBody =
    'Hi there,\n\n' +
    'Here is your team dashboard link for ' + companyName + ':\n\n' +
    dashboardUrl + '\n\n' +
    'Use it to add or remove colleagues, see who has access, and check your renewal date. ' +
    'Treat it like a password — anyone with the link can manage your seats.\n\n' +
    'If you didn’t request this, you can ignore the email — the link simply won’t be used.\n\n' +
    'Venkat\nEditor, The State of Play\n' +
    '—\nLeft Field Ventures · Ground Floor, 36 Infantry Road, Bengaluru 560001';

  const htmlBody =
    '<div style="font-family: Georgia, \'Times New Roman\', serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">' +

      '<p style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">' +
        '— The State of Play —' +
      '</p>' +

      '<h1 style="font-size: 28px; font-weight: 600; line-height: 1.15; margin: 0 0 24px;">' +
        'Your team <em style="font-weight: normal;">dashboard.</em>' +
      '</h1>' +

      '<p>Here is the dashboard link for <strong>' + companyName + '</strong>. ' +
        'It’s how you add or remove colleagues, see who has access, and check your renewal date.</p>' +

      '<p style="margin: 32px 0;">' +
        '<a href="' + dashboardUrl + '" style="display: inline-block; background: #A0291C; color: #FFFFFF; padding: 14px 28px; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500;">' +
          'Open your dashboard →' +
        '</a>' +
      '</p>' +

      '<p style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 13px; color: #666666;">' +
        'Or paste this into your browser:<br>' +
        '<span style="color: #A0291C; word-break: break-all;">' + dashboardUrl + '</span>' +
      '</p>' +

      '<p style="color: #555555;">' +
        'Treat this link like a password — anyone with it can manage your seats. ' +
        'If you didn’t request this email, you can safely ignore it; the link simply won’t be used.' +
      '</p>' +

      '<p>Glad to have your team along.</p>' +

      '<p style="margin-top: 32px;">' +
        'Venkat<br>' +
        '<span style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 13px; color: #666666;">' +
          'Editor, The State of Play' +
        '</span>' +
      '</p>' +

      '<hr style="border: 0; border-top: 1px solid #E5E2DC; margin: 32px 0 16px;">' +

      '<p style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 12px; color: #999999; line-height: 1.7;">' +
        'Left Field Ventures · Ground Floor, 36 Infantry Road, Bengaluru 560001<br>' +
        'For anything you need on this account, write to ' +
        '<a href="mailto:prerna@stateofplay.club" style="color: #A0291C;">prerna@stateofplay.club</a>.' +
      '</p>' +
    '</div>';

  MailApp.sendEmail({
    to:      email,
    subject: subject,
    htmlBody: htmlBody,
    body:    textBody,
    name:    'Venkat Ananth · The State of Play',
    replyTo: 'prerna@stateofplay.club',
  });
}

function testConfiguration() {
  const sheetId  = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  const ghostKey = PropertiesService.getScriptProperties().getProperty('GHOST_ADMIN_API_KEY');

  Logger.log('SHEET_ID configured: ' + (sheetId ? 'Yes (' + sheetId.substring(0, 10) + '...)' : 'NO'));
  Logger.log('GHOST_ADMIN_API_KEY configured: ' + (ghostKey ? 'Yes' : 'NO'));

  if (sheetId) {
    try {
      const ss            = SpreadsheetApp.openById(sheetId);
      const accountsSheet = ss.getSheetByName(ACCOUNTS_SHEET_NAME);
      const membersSheet  = ss.getSheetByName(MEMBERS_SHEET_NAME);
      Logger.log('Sheet access: OK (' + ss.getName() + ')');
      Logger.log('Accounts sheet: ' + (accountsSheet ? 'Found' : 'NOT FOUND'));
      Logger.log('Members sheet: '  + (membersSheet  ? 'Found' : 'NOT FOUND'));
    } catch (e) {
      Logger.log('Sheet access ERROR: ' + e.toString());
    }
  }

  if (ghostKey) {
    const token = generateGhostJWT();
    Logger.log('Ghost JWT generation: ' + (token ? 'OK' : 'FAILED'));
  }
}

function testGhostConnection() {
  const token = generateGhostJWT();
  if (!token) {
    Logger.log('ERROR: Could not generate Ghost JWT');
    return;
  }

  const url     = GHOST_URL + '/ghost/api/admin/members/?limit=1';
  const options = {
    method:  'GET',
    headers: { 'Authorization': 'Ghost ' + token },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  Logger.log('Ghost API response code: ' + response.getResponseCode());
  Logger.log('Ghost API response: ' + response.getContentText().substring(0, 500));
}

/**
 * Replace the email below with a real Ghost member email before running.
 */
function testLastSeenBatch() {
  const testEmails = ['replace-with-real@email.com'];
  const result     = getGhostLastSeenBatch(testEmails);
  Logger.log('last_seen_at result: ' + JSON.stringify(result));
}

/**
 * Replace both values below with real data before running.
 */
function testMagicLinkInvitation() {
  const result = sendMagicLinkInvitation({
    memberEmail:   'venkz86@gmail.com',
    ghostMemberId: '68e3ee1d3cbce90001ce2d8b',
    companyName:   'The State of Play',
    adminEmail:    'venkat@stateofplay.club',
  });
  Logger.log('Magic link result: ' + JSON.stringify(result));
}

function testSendDashboardLink() {
  const result = handleSendDashboardLink({ email: 'venkat@stateofplay.club' });
  Logger.log('Dashboard link result: ' + result.getContent());
}
/**
 * POST { action: "nominate", subscriber_name, subscriber_email,
 *        subscriber_ghost_id, nominee_name, nominee_email, nominee_context }
 *
 * Always returns success (so the frontend can't be used to enumerate
 * which emails are already nominated). Logs to the Nominations tab and
 * fires a Slack ping for ops.
 */
function handleNominate(payload) {
  try {
    var required = ['subscriber_email', 'nominee_name', 'nominee_email', 'nominee_context'];
    for (var i = 0; i < required.length; i++) {
      if (!payload[required[i]]) {
        Logger.log('nominate missing field: ' + required[i]);
        return jsonResponse({ success: true });  // intentionally silent
      }
    }

    var sheet = getNominationsSheet();

    sheet.appendRow([
      new Date(),                              // nomination_date
      payload.subscriber_name || '',           // subscriber_name
      payload.subscriber_email || '',          // subscriber_email
      payload.subscriber_ghost_id || '',       // subscriber_ghost_id
      payload.nominee_name || '',              // nominee_name
      String(payload.nominee_email || '').toLowerCase().trim(),  // nominee_email
      payload.nominee_context || '',           // nominee_context
      'Pending',                               // status
      '',                                      // story_sent
      '',                                      // cold_link
      '',                                      // sent_date
      '',                                      // converted_date
      ''                                       // subscriber_notified
    ]);

    Logger.log('Nomination logged: ' + payload.nominee_email + ' from ' + payload.subscriber_email);

    // Fire Slack notification (non-fatal if it fails)
    try {
      sendNominationSlack(payload);
    } catch (slackErr) {
      Logger.log('Slack ping failed (non-fatal): ' + slackErr.toString());
    }

    return jsonResponse({ success: true });

  } catch (err) {
    Logger.log('handleNominate error: ' + err.toString());
    return jsonResponse({ success: true });  // still silent
  }
}

/**
 * Get (or create) the Nominations tab. Adds the header row on first run.
 */
function getNominationsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(NOMINATIONS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(NOMINATIONS_SHEET_NAME);
    sheet.appendRow(NOMINATION_COLUMNS);
    // Style the header row
    var headerRange = sheet.getRange(1, 1, 1, NOMINATION_COLUMNS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1A1A1A');
    headerRange.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Format and post to TSOP ops Slack channel.
 */
function sendNominationSlack(payload) {
  if (!SLACK_WEBHOOK_URL || SLACK_WEBHOOK_URL.indexOf('PASTE_YOUR') === 0) {
    Logger.log('Slack webhook not configured — skipping ping');
    return;
  }

  var text =
    '*NEW NOMINATION*\n\n' +
    '*From:* ' + (payload.subscriber_name || 'Unknown') +
      ' (' + (payload.subscriber_email || '—') + ')\n' +
    '*Nominee:* ' + (payload.nominee_name || 'Unknown') +
      ' — ' + (payload.nominee_context || '') + '\n' +
    '*Email:* ' + (payload.nominee_email || '—') + '\n\n' +
    '*REPLY WITH:*\n' +
    '`APPROVE ' + (payload.nominee_email || 'email') + ' [post-slug]`  → queue outreach\n' +
    '`PASS`  → skip';

  UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify({ text: text }),
    muteHttpExceptions: true,
  });
}
/**
 * Render's /api/cold-link/event handler forwards this when a nominee
 * signs up. We update the Sheet row + post the conversion Slack.
 * Slack message includes "Reply YES" — your existing Slack inbound
 * webhook (Session 3) is what listens for the YES and creates the
 * Gmail draft via createConversionGmailDraft() below.
 */
function handleNominationConverted(payload) {
  try {
    var sheet = getNominationsSheet();
    var data = sheet.getDataRange().getValues();
    var nomineeEmail = String(payload.nominee_email || '').toLowerCase().trim();

    // Find the row for this nominee (column F is nominee_email, index 5)
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][5]).toLowerCase().trim() === nomineeEmail) {
        sheet.getRange(i + 1, 8).setValue('Converted');             // status
        sheet.getRange(i + 1, 12).setValue(new Date());             // converted_date
        break;
      }
    }

    var kind = payload.conversion_kind || 'free';
    var text =
      '*NOMINATION CONVERTED*\n\n' +
      (payload.nominee_name || payload.nominee_email || 'A reader') +
        ' just signed up (' + kind + ')\n' +
      'Nominated by: ' + (payload.subscriber_name || '—') + '\n' +
      'Story: ' + (payload.post_slug || '—') + '\n' +
      'Days from nomination to signup: ' + (payload.days_to_convert ?? '—') + '\n\n' +
      'Reply *YES* in this channel to create a Gmail draft closing the loop ' +
      'with ' + (payload.subscriber_name || 'the nominator') + '.';

    if (typeof SLACK_WEBHOOK_URL !== 'undefined' && SLACK_WEBHOOK_URL) {
      UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify({ text: text }),
        muteHttpExceptions: true,
      });
    }
/**
 * Time-driven trigger target: sweeps nominations whose 14-day full-access
 * window has closed. Calls the backend's admin-gated expire-check
 * endpoint, which strips the nomination-access Ghost label and sends the
 * "Your two weeks are up" email via Resend.
 *
 * One-time setup: Apps Script editor → Triggers (clock icon, left
 * sidebar) → Add Trigger → function: runNominationAccessExpiryCheck →
 * event source: Time-driven → type: Day timer → pick any time (a grant
 * closing a few hours late is harmless). Once a day is enough.
 */
function runNominationAccessExpiryCheck() {
  try {
    var res = UrlFetchApp.fetch(RENDER_API_URL + '/api/nominations/access/expire-check', {
      method: 'POST',
      headers: { 'X-Admin-Key': RENDER_ADMIN_KEY },
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    Logger.log('nomination access expire-check: HTTP ' + code + ' — ' + res.getContentText());
    if (code !== 200) {
      Logger.log('nomination access expire-check FAILED — check Render logs too');
    }
  } catch (err) {
    Logger.log('nomination access expire-check error: ' + err.toString());
  }
}
    // Stash the conversion context in script properties so the YES handler
    // (Session 3) can pull it back when it arrives.
    PropertiesService.getScriptProperties().setProperty(
      'pending_conversion_' + nomineeEmail,
      JSON.stringify(payload)
    );

    return jsonResponse({ success: true });

  } catch (err) {
    Logger.log('handleNominationConverted error: ' + err.toString());
    return jsonResponse({ success: true });
  }
}

/**
 * Editorial-styled nominee email. Sent from venkat@stateofplay.club.
 * Single CTA → story_url (which is the /s/{token} link). No paywall.
 */
function sendNomineeEmail(payload) {
  var nomineeFirst = (payload.nominee_name || '').split(' ')[0] || 'there';
  var subscriberName = payload.subscriber_name || 'A State of Play reader';
  var subscriberFirst = subscriberName.split(' ')[0];
  var storyUrl = payload.story_url;
  var postSlug = payload.post_slug || '';
  // We don't carry the story title in the payload; the slug is good enough
  // as a fallback. Most slugs are human-readable.
  var storyDisplay = postSlug
    ? postSlug.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); })
    : 'a recent story';

  var subject = subscriberFirst + ' thought you should read this';

  var textBody =
    nomineeFirst + ',\n\n' +
    subscriberName + ' reads The State of Play and thought you should too.\n\n' +
    'Here’s a piece they picked for you:\n\n' +
    storyDisplay + '\n' +
    storyUrl + '\n\n' +
    'No paywall. Just read it.\n\n' +
    'If it’s not for you, no problem at all.\n\n' +
    'Venkat\n' +
    'Editor, The State of Play\n' +
    'stateofplay.club';

  var htmlBody =
    '<div style="font-family: Georgia, \'Times New Roman\', serif; max-width: 560px; margin: 0 auto; color: #1A1A1A; line-height: 1.7; font-size: 16px;">' +

      '<p style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #999999; margin: 0 0 12px;">' +
        '— The State of Play —' +
      '</p>' +

      '<h1 style="font-size: 26px; font-weight: 600; line-height: 1.2; margin: 0 0 24px;">' +
        nomineeFirst + ',' +
      '</h1>' +

      '<p><strong>' + subscriberName + '</strong> reads The State of Play and thought you should too.</p>' +

      '<p>Here’s a piece they picked for you:</p>' +

      '<p style="margin: 28px 0;">' +
        '<a href="' + storyUrl + '" style="display: inline-block; background: #A0291C; color: #FFFFFF; padding: 14px 28px; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500;">' +
          'Read the story →' +
        '</a>' +
      '</p>' +

      '<p style="color: #555555; font-size: 15px;">No paywall. Just read it. ' +
        'If it’s not for you, no problem at all.</p>' +

      '<p style="margin-top: 32px;">' +
        'Venkat<br>' +
        '<span style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 13px; color: #666666;">' +
          'Editor, The State of Play' +
        '</span>' +
      '</p>' +

      '<hr style="border: 0; border-top: 1px solid #E5E2DC; margin: 32px 0 16px;">' +

      '<p style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; font-size: 12px; color: #999999; line-height: 1.7;">' +
        'You’re receiving this once because ' + subscriberName + ' nominated you. ' +
        'We won’t email again unless you sign up. ' +
        'Left Field Ventures · Ground Floor, 36 Infantry Road, Bengaluru 560001' +
      '</p>' +
    '</div>';

  MailApp.sendEmail({
    to:       payload.nominee_email,
    subject:  subject,
    htmlBody: htmlBody,
    body:     textBody,
    name:     'Venkat Ananth · The State of Play',
    replyTo:  'venkat@stateofplay.club',
  });
}
/**
 * Slack slash command router. Slack sends form fields:
 *   token, team_id, channel_id, user_id, user_name, command, text, response_url
 */
function handleSlackCommand(p) {
  if (SLACK_VERIFICATION_TOKEN && SLACK_VERIFICATION_TOKEN.indexOf('PASTE_') !== 0
      && p.token !== SLACK_VERIFICATION_TOKEN) {
    return ContentService.createTextOutput('Forbidden').setMimeType(ContentService.MimeType.TEXT);
  }

  var cmd = (p.command || '').toLowerCase();
  var args = (p.text || '').trim().split(/\s+/).filter(Boolean);

  if (cmd === '/approve') return handleSlackApprove(args, p);
  if (cmd === '/pass')    return handleSlackPass(args, p);
  if (cmd === '/yes')     return handleSlackYes(args, p);

  return slackResponse('Unknown command.');
}

/** /approve nominee@email.com post-slug */
function handleSlackApprove(args, p) {
  if (args.length < 2) {
    return slackResponse('Usage: `/approve nominee@email.com post-slug`');
  }
  var nomineeEmail = args[0].toLowerCase().trim();
  var postSlug = args[1].trim();

  var sheet = getNominationsSheet();
  var data = sheet.getDataRange().getValues();
  var rowIdx = -1, row = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][5]).toLowerCase().trim() === nomineeEmail) {
      rowIdx = i + 1;
      row = data[i];
      break;
    }
  }
  if (rowIdx < 0) {
    return slackResponse('No pending nomination found for ' + nomineeEmail + '.');
  }

  // Mint a fresh cold-link via Render (existing endpoint)
  var coldUrl = '';
  try {
    var res = UrlFetchApp.fetch(RENDER_API_URL + '/api/cold-link/generate', {
      method: 'POST',
      contentType: 'application/json',
      headers: { 'X-Admin-Key': RENDER_ADMIN_KEY },
      payload: JSON.stringify({ post_slug: postSlug }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() === 200) {
      coldUrl = JSON.parse(res.getContentText()).url;
    } else {
      Logger.log('cold-link/generate failed: HTTP ' + res.getResponseCode());
    }
  } catch (err) {
    Logger.log('cold-link/generate error: ' + err.toString());
  }
  if (!coldUrl) {
    return slackResponse('Could not mint cold link. Check Render logs.');
  }

  // Update sheet
  sheet.getRange(rowIdx, 8).setValue('Approved');     // status
  sheet.getRange(rowIdx, 9).setValue(postSlug);       // story_sent
  sheet.getRange(rowIdx, 10).setValue(coldUrl);       // cold_link
  sheet.getRange(rowIdx, 11).setValue(new Date());    // sent_date

  // Send the nominee email
  try {
    sendNomineeEmail({
      nominee_name: row[4],
      nominee_email: nomineeEmail,
      subscriber_name: row[1],
      post_slug: postSlug,
      story_url: coldUrl,
    });
  } catch (mailErr) {
    Logger.log('nominee email failed: ' + mailErr.toString());
  }

  var fyExpires = new Date();
  fyExpires.setDate(fyExpires.getDate() + 14);
  return slackResponse(
    '*APPROVED — link ready*\n' +
    'Nominee: ' + nomineeEmail + '\n' +
    'Story: ' + postSlug + '\n' +
    'Link: ' + coldUrl + '\n' +
    'Expires: ' + Utilities.formatDate(fyExpires, 'GMT+0530', 'd MMM yyyy') + '\n\n' +
    'Email has been sent to ' + nomineeEmail + '.'
  );
}

/** /pass nominee@email.com */
function handleSlackPass(args, p) {
  if (args.length < 1) return slackResponse('Usage: `/pass nominee@email.com`');
  var nomineeEmail = args[0].toLowerCase().trim();

  var sheet = getNominationsSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][5]).toLowerCase().trim() === nomineeEmail) {
      sheet.getRange(i + 1, 8).setValue('Passed');
      return slackResponse('Passed. Sheet updated for ' + nomineeEmail + '.');
    }
  }
  return slackResponse('No nomination found for ' + nomineeEmail + '.');
}

/** /yes nominee@email.com — create Gmail draft to the nominator */
function handleSlackYes(args, p) {
  if (args.length < 1) return slackResponse('Usage: `/yes nominee@email.com`');
  var nomineeEmail = args[0].toLowerCase().trim();

  // Pull stashed conversion context (or read from sheet as fallback)
  var props = PropertiesService.getScriptProperties();
  var key = 'pending_conversion_' + nomineeEmail;
  var stashed = props.getProperty(key);
  var ctx;
  if (stashed) {
    ctx = JSON.parse(stashed);
  } else {
    var sheet = getNominationsSheet();
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][5]).toLowerCase().trim() === nomineeEmail) {
        ctx = {
          subscriber_name: data[i][1],
          subscriber_email: data[i][2],
          nominee_name: data[i][4],
          nominee_email: nomineeEmail,
        };
        break;
      }
    }
  }
  if (!ctx || !ctx.subscriber_email) {
    return slackResponse('No nomination context for ' + nomineeEmail + '.');
  }

  var subscriberFirst = (ctx.subscriber_name || '').split(' ')[0] || 'there';
  var nomineeFirst = (ctx.nominee_name || ctx.nominee_email || '').split(' ')[0];

  var draftSubject = 'Someone you recommended';
  var draftBody =
    subscriberFirst + ',\n\n' +
    nomineeFirst + ' — the person you recommended — just signed up.\n\n' +
    'Good call.\n\n' +
    'Venkat';

  try {
    GmailApp.createDraft(ctx.subscriber_email, draftSubject, draftBody);
  } catch (err) {
    Logger.log('Gmail draft failed: ' + err.toString());
    return slackResponse('Could not create Gmail draft. ' + err.toString());
  }

  // Mark sheet as subscriber-notified
  var sheet = getNominationsSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][5]).toLowerCase().trim() === nomineeEmail) {
      sheet.getRange(i + 1, 13).setValue('Draft created ' + new Date().toISOString());
      break;
    }
  }
  props.deleteProperty(key);

  return slackResponse('Draft created in Gmail to ' + ctx.subscriber_email + '. Go edit and send.');
}
function _testNomination() {
  handleNominationSubmitted({
    action: 'nomination_submitted',
    subscriber_name: 'Test Subscriber',
    subscriber_email: 'hello@venkatananth.me',
    nominee_name: 'Test Nominee',
    nominee_email: 'venkz86@gmail.com',   // ← put a real address you own
    nominee_context: 'Runs franchise strategy at a Tier-1 team.',
    post_slug: 'the-broadcast-question',
    token_id: 'test-token-12345',
  });
}
function _testEmailOnly() {
  sendNominationEmail_({
    nomineeEmail: 'venkz86@gmail.com',
    nomineeName: 'Test Nominee',
    subscriberName: 'Test Subscriber',
    subscriberFirst: 'Test',
    note: 'Runs franchise strategy at a Tier-1 team.',
    storyUrl: 'https://www.stateofplay.club/s/test-token-12345',
  });
}
/** Tiny helper: returns a Slack-friendly text response. */
function slackResponse(text) {
  return ContentService
    .createTextOutput(JSON.stringify({ response_type: 'in_channel', text: text }))
    .setMimeType(ContentService.MimeType.JSON);
}
function testSendLoginLink() {
  var result = handleSendLoginLink({
    email: 'venkz86@gmail.com',
    login_url: 'https://www.stateofplay.club/login/verify?token=test-token-12345',
  });
  Logger.log('Send login link result: ' + result.getContent());
}
