/**
 * =============================================================================
 * THE STATE OF PLAY - CORPORATE SUBSCRIPTIONS BACKEND
 * =============================================================================
 * 
 * Google Apps Script backend for managing corporate team subscriptions.
 * Handles account creation, member management, and Ghost CMS integration.
 * 
 * =============================================================================
 * DEPLOYMENT INSTRUCTIONS
 * =============================================================================
 * 
 * 1. Create a new Google Apps Script project:
 *    - Go to https://script.google.com
 *    - Click "New Project"
 *    - Delete default code and paste this entire file
 * 
 * 2. Set up Script Properties:
 *    - Click "Project Settings" (gear icon) in left sidebar
 *    - Scroll to "Script Properties"
 *    - Add these properties:
 *      - GHOST_ADMIN_API_KEY: Your Ghost Admin API key (format: "id:secret")
 *      - SHEET_ID: Your Google Sheet ID (from the URL)
 * 
 * 3. Deploy as Web App:
 *    - Click "Deploy" → "New deployment"
 *    - Select type: "Web app"
 *    - Description: "TSOP Corporate Subscriptions API v1"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 *    - Click "Deploy"
 *    - Copy the Web App URL (you'll need this for Zapier and the dashboard)
 * 
 * 4. Test the deployment:
 *    - Visit: {WEB_APP_URL}?token=test
 *    - Should return: {"success":false,"error":"Invalid access link"}
 * 
 * =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

// Google Sheet ID - Get this from Script Properties or hardcode here
const SHEET_ID = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || 'YOUR_SHEET_ID_HERE';

// Sheet tab names
const ACCOUNTS_SHEET_NAME = 'accounts';
const MEMBERS_SHEET_NAME = 'members';

// Ghost CMS Configuration
const GHOST_URL = 'https://www.stateofplay.club';
const GHOST_API_VERSION = 'v5.0';

/**
 * =============================================================================
 * MAIN HANDLERS
 * =============================================================================
 */

/**
 * Handle GET requests - Load dashboard data
 * URL: /exec?token={dashboard_token}
 */
function doGet(e) {
  try {
    const token = e.parameter.token;
    
    if (!token) {
      return jsonResponse({ success: false, error: 'Missing access token' });
    }
    
    // Get account by token
    const account = getAccountByToken(token);
    if (!account) {
      return jsonResponse({ success: false, error: 'Invalid access link' });
    }
    
    // Check if account is active
    if (account.status !== 'active') {
      return jsonResponse({ success: false, error: 'This subscription is no longer active' });
    }
    
    // Get members for this account
    const members = getMembers(account.account_id);
    
    return jsonResponse({
      success: true,
      data: {
        account: {
          account_id: account.account_id,
          company_name: account.company_name,
          admin_email: account.admin_email,
          company_domain: account.company_domain,
          plan_name: account.plan_name,
          seats: account.seats,
          renewal_date: account.renewal_date,
          status: account.status
        },
        members: members.map(m => ({
          member_id: m.member_id,
          email: m.email,
          added_at: m.added_at
        }))
      }
    });
    
  } catch (error) {
    Logger.log('doGet error: ' + error.toString());
    return jsonResponse({ success: false, error: 'An error occurred. Please try again.' });
  }
}

/**
 * Handle POST requests - Create account, add/remove members
 */
function doPost(e) {
  try {
    // Parse request body
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return jsonResponse({ success: false, error: 'Invalid request format' });
    }
    
    const action = payload.action;
    
    switch (action) {
      case 'create_account':
        return handleCreateAccount(payload);
      case 'add_member':
        return handleAddMember(payload);
      case 'remove_member':
        return handleRemoveMember(payload);
      case 'get_account':
        // Alternative way to get account data via POST
        return handleGetAccount(payload);
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
  // Validate required fields
  const requiredFields = ['company_name', 'admin_email', 'plan_name', 'seats', 'amount_paid', 'currency'];
  for (const field of requiredFields) {
    if (!payload[field]) {
      return jsonResponse({ success: false, error: 'Missing required field: ' + field });
    }
  }
  
  try {
    const sheet = getAccountsSheet();
    
    // Generate IDs and tokens
    const accountId = 'ACC' + Date.now();
    const dashboardToken = Utilities.getUuid();
    
    // Extract company domain from admin email
    const adminEmail = payload.admin_email.toLowerCase().trim();
    const companyDomain = adminEmail.split('@')[1];
    
    // Calculate dates
    const createdAt = new Date().toISOString();
    const renewalDate = new Date();
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    const renewalDateStr = renewalDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Prepare row data (must match column order in sheet)
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
    
    // Append row to sheet
    sheet.appendRow(rowData);
    
    Logger.log('Created account: ' + accountId + ' for ' + payload.company_name);
    
    return jsonResponse({
      success: true,
      data: {
        account_id: accountId,
        dashboard_token: dashboardToken,
        dashboard_url: 'https://www.stateofplay.club/teams/manage?token=' + dashboardToken
      }
    });
    
  } catch (error) {
    Logger.log('handleCreateAccount error: ' + error.toString());
    return jsonResponse({ success: false, error: 'Failed to create account. Please try again.' });
  }
}

/**
 * Add a team member to an account
 */
function handleAddMember(payload) {
  // Validate required fields
  if (!payload.token) {
    return jsonResponse({ success: false, error: 'Missing access token' });
  }
  if (!payload.email) {
    return jsonResponse({ success: false, error: 'Missing required field: email' });
  }
  
  try {
    // Get account by token
    const account = getAccountByToken(payload.token);
    if (!account) {
      return jsonResponse({ success: false, error: 'Invalid access link' });
    }
    
    // Check if account is active
    if (account.status !== 'active') {
      return jsonResponse({ success: false, error: 'This subscription is no longer active' });
    }
    
    // Normalize email
    const email = payload.email.toLowerCase().trim();
    
    // STRICT EMAIL VALIDATION - Must match company domain
    const emailDomain = email.split('@')[1];
    if (emailDomain !== account.company_domain) {
      return jsonResponse({ 
        success: false, 
        error: 'Only emails from ' + account.company_domain + ' are allowed' 
      });
    }
    
    // Check seat limit
    const currentMembers = getMembers(account.account_id);
    if (currentMembers.length >= account.seats) {
      return jsonResponse({ 
        success: false, 
        error: 'All ' + account.seats + ' seats are filled. Remove a member to add a new one.' 
      });
    }
    
    // Check for duplicate (active members only)
    const existingMember = currentMembers.find(m => m.email === email);
    if (existingMember) {
      return jsonResponse({ 
        success: false, 
        error: 'This email is already a team member' 
      });
    }
    
    // Create Ghost member
    const ghostResult = createGhostMember(email, account.account_id);
    if (!ghostResult.success) {
      return jsonResponse({ 
        success: false, 
        error: ghostResult.error || 'Failed to create member. Please try again.' 
      });
    }
    
    // Generate member ID
    const memberId = 'MEM' + Date.now();
    const addedAt = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Add to members sheet
    const membersSheet = getMembersSheet();
    membersSheet.appendRow([
      memberId,                    // A: member_id
      account.account_id,          // B: account_id
      email,                       // C: email
      ghostResult.ghost_member_id, // D: ghost_member_id
      addedAt,                     // E: added_at
      'active'                     // F: status
    ]);
    
    Logger.log('Added member: ' + email + ' to account ' + account.account_id);
    
    return jsonResponse({
      success: true,
      data: {
        member_id: memberId,
        email: email
      }
    });
    
  } catch (error) {
    Logger.log('handleAddMember error: ' + error.toString());
    return jsonResponse({ success: false, error: 'Failed to add member. Please try again.' });
  }
}

/**
 * Remove a team member from an account
 */
function handleRemoveMember(payload) {
  // Validate required fields
  if (!payload.token) {
    return jsonResponse({ success: false, error: 'Missing access token' });
  }
  if (!payload.member_id) {
    return jsonResponse({ success: false, error: 'Missing required field: member_id' });
  }
  
  try {
    // Get account by token
    const account = getAccountByToken(payload.token);
    if (!account) {
      return jsonResponse({ success: false, error: 'Invalid access link' });
    }
    
    // Find the member
    const membersSheet = getMembersSheet();
    const data = membersSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices
    const memberIdCol = headers.indexOf('member_id');
    const accountIdCol = headers.indexOf('account_id');
    const ghostMemberIdCol = headers.indexOf('ghost_member_id');
    const statusCol = headers.indexOf('status');
    
    // Find the member row
    let memberRow = -1;
    let memberData = null;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][memberIdCol] === payload.member_id) {
        // Verify this member belongs to the token's account
        if (data[i][accountIdCol] !== account.account_id) {
          return jsonResponse({ success: false, error: 'Member not found in this account' });
        }
        memberRow = i + 1; // Sheets are 1-indexed
        memberData = data[i];
        break;
      }
    }
    
    if (memberRow === -1) {
      return jsonResponse({ success: false, error: 'Member not found' });
    }
    
    // Delete from Ghost
    const ghostMemberId = memberData[ghostMemberIdCol];
    if (ghostMemberId) {
      const deleteResult = deleteGhostMember(ghostMemberId);
      if (!deleteResult.success) {
        Logger.log('Warning: Failed to delete Ghost member: ' + deleteResult.error);
        // Continue anyway - we'll mark as removed in our system
      }
    }
    
    // Update status to "removed" (don't delete the row for audit trail)
    membersSheet.getRange(memberRow, statusCol + 1).setValue('removed');
    
    Logger.log('Removed member: ' + payload.member_id + ' from account ' + account.account_id);
    
    return jsonResponse({
      success: true,
      data: {
        member_id: payload.member_id
      }
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
  
  // Reuse GET logic
  const account = getAccountByToken(payload.token);
  if (!account) {
    return jsonResponse({ success: false, error: 'Invalid access link' });
  }
  
  if (account.status !== 'active') {
    return jsonResponse({ success: false, error: 'This subscription is no longer active' });
  }
  
  const members = getMembers(account.account_id);
  
  return jsonResponse({
    success: true,
    data: {
      account: {
        account_id: account.account_id,
        company_name: account.company_name,
        admin_email: account.admin_email,
        company_domain: account.company_domain,
        plan_name: account.plan_name,
        seats: account.seats,
        renewal_date: account.renewal_date,
        status: account.status
      },
      members: members.map(m => ({
        member_id: m.member_id,
        email: m.email,
        added_at: m.added_at
      }))
    }
  });
}

/**
 * =============================================================================
 * HELPER FUNCTIONS - DATA ACCESS
 * =============================================================================
 */

/**
 * Get the accounts sheet
 */
function getAccountsSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return ss.getSheetByName(ACCOUNTS_SHEET_NAME);
}

/**
 * Get the members sheet
 */
function getMembersSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return ss.getSheetByName(MEMBERS_SHEET_NAME);
}

/**
 * Find an account by its dashboard token
 * Returns account object or null if not found
 */
function getAccountByToken(token) {
  const sheet = getAccountsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Find token column index
  const tokenCol = headers.indexOf('dashboard_token');
  if (tokenCol === -1) {
    Logger.log('Error: dashboard_token column not found');
    return null;
  }
  
  // Search for matching token
  for (let i = 1; i < data.length; i++) {
    if (data[i][tokenCol] === token) {
      // Build account object from row
      const account = {};
      for (let j = 0; j < headers.length; j++) {
        account[headers[j]] = data[i][j];
      }
      // Ensure seats is a number
      account.seats = parseInt(account.seats) || 0;
      return account;
    }
  }
  
  return null;
}

/**
 * Get all active members for an account
 */
function getMembers(accountId) {
  const sheet = getMembersSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const members = [];
  
  // Find column indices
  const accountIdCol = headers.indexOf('account_id');
  const statusCol = headers.indexOf('status');
  
  for (let i = 1; i < data.length; i++) {
    // Only include active members for this account
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
 * HELPER FUNCTIONS - GHOST API
 * =============================================================================
 */

/**
 * Generate JWT token for Ghost Admin API authentication
 * Ghost uses HS256 with a hex-encoded secret
 */
function generateGhostJWT() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GHOST_ADMIN_API_KEY');
  
  if (!apiKey || !apiKey.includes(':')) {
    Logger.log('Error: GHOST_ADMIN_API_KEY not configured or invalid format');
    return null;
  }
  
  const [id, secret] = apiKey.split(':');
  
  // Current timestamp
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 300; // 5 minutes
  
  // Create header
  const header = {
    alg: 'HS256',
    typ: 'JWT',
    kid: id
  };
  
  // Create payload
  const payload = {
    iat: iat,
    exp: exp,
    aud: '/admin/'
  };
  
  // Encode header and payload
  const encodedHeader = Utilities.base64EncodeWebSafe(JSON.stringify(header)).replace(/=+$/, '');
  const encodedPayload = Utilities.base64EncodeWebSafe(JSON.stringify(payload)).replace(/=+$/, '');
  
  // Create signature
  const signatureInput = encodedHeader + '.' + encodedPayload;
  
  // Convert hex secret to bytes
  const secretBytes = hexToBytes(secret);
  
  // Sign with HMAC-SHA256
  const signature = Utilities.computeHmacSha256Signature(signatureInput, secretBytes);
  const encodedSignature = Utilities.base64EncodeWebSafe(signature).replace(/=+$/, '');
  
  return encodedHeader + '.' + encodedPayload + '.' + encodedSignature;
}

/**
 * Convert hex string to byte array
 */
function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

/**
 * Create a member in Ghost CMS
 * Returns: { success: true, ghost_member_id: "..." } or { success: false, error: "..." }
 */
function createGhostMember(email, accountId) {
  try {
    const token = generateGhostJWT();
    if (!token) {
      return { success: false, error: 'Ghost API not configured' };
    }
    
    const url = GHOST_URL + '/ghost/api/admin/members/';
    
    const payload = {
      members: [{
        email: email,
        labels: [
          { name: 'corporate-member' },
          { name: 'corp-' + accountId }
        ]
      }]
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Authorization': 'Ghost ' + token,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    
    Logger.log('Ghost create member response: ' + responseCode + ' - ' + responseBody);
    
    if (responseCode === 201 || responseCode === 200) {
      const data = JSON.parse(responseBody);
      const ghostMemberId = data.members[0].id;
      return { success: true, ghost_member_id: ghostMemberId };
    } else if (responseCode === 422) {
      // Member already exists in Ghost
      const data = JSON.parse(responseBody);
      if (data.errors && data.errors[0] && data.errors[0].message.includes('already exists')) {
        // Try to find existing member
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
 * Find a Ghost member by email
 */
function findGhostMemberByEmail(email) {
  try {
    const token = generateGhostJWT();
    if (!token) return null;
    
    const url = GHOST_URL + '/ghost/api/admin/members/?filter=email:' + encodeURIComponent(email);
    
    const options = {
      method: 'GET',
      headers: {
        'Authorization': 'Ghost ' + token
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      if (data.members && data.members.length > 0) {
        return data.members[0];
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log('findGhostMemberByEmail error: ' + error.toString());
    return null;
  }
}

/**
 * Delete a member from Ghost CMS
 * Returns: { success: true } or { success: false, error: "..." }
 */
function deleteGhostMember(ghostMemberId) {
  try {
    const token = generateGhostJWT();
    if (!token) {
      return { success: false, error: 'Ghost API not configured' };
    }
    
    const url = GHOST_URL + '/ghost/api/admin/members/' + ghostMemberId + '/';
    
    const options = {
      method: 'DELETE',
      headers: {
        'Authorization': 'Ghost ' + token
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    Logger.log('Ghost delete member response: ' + responseCode);
    
    if (responseCode === 204 || responseCode === 200 || responseCode === 404) {
      // 204: Successfully deleted
      // 404: Already doesn't exist (that's fine)
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
 * UTILITY FUNCTIONS
 * =============================================================================
 */

/**
 * Create a JSON response with proper content type
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * =============================================================================
 * TEST FUNCTIONS (Run these manually to verify setup)
 * =============================================================================
 */

/**
 * Test that Script Properties are configured
 */
function testConfiguration() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  const ghostKey = PropertiesService.getScriptProperties().getProperty('GHOST_ADMIN_API_KEY');
  
  Logger.log('SHEET_ID configured: ' + (sheetId ? 'Yes (' + sheetId.substring(0, 10) + '...)' : 'NO'));
  Logger.log('GHOST_ADMIN_API_KEY configured: ' + (ghostKey ? 'Yes' : 'NO'));
  
  if (sheetId) {
    try {
      const ss = SpreadsheetApp.openById(sheetId);
      Logger.log('Sheet access: OK (' + ss.getName() + ')');
      
      const accountsSheet = ss.getSheetByName(ACCOUNTS_SHEET_NAME);
      const membersSheet = ss.getSheetByName(MEMBERS_SHEET_NAME);
      
      Logger.log('Accounts sheet: ' + (accountsSheet ? 'Found' : 'NOT FOUND'));
      Logger.log('Members sheet: ' + (membersSheet ? 'Found' : 'NOT FOUND'));
    } catch (e) {
      Logger.log('Sheet access ERROR: ' + e.toString());
    }
  }
  
  if (ghostKey) {
    const token = generateGhostJWT();
    Logger.log('Ghost JWT generation: ' + (token ? 'OK' : 'FAILED'));
  }
}

/**
 * Test Ghost API connection
 */
function testGhostConnection() {
  const token = generateGhostJWT();
  if (!token) {
    Logger.log('ERROR: Could not generate Ghost JWT');
    return;
  }
  
  const url = GHOST_URL + '/ghost/api/admin/members/?limit=1';
  
  const options = {
    method: 'GET',
    headers: {
      'Authorization': 'Ghost ' + token
    },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  Logger.log('Ghost API response code: ' + response.getResponseCode());
  Logger.log('Ghost API response: ' + response.getContentText().substring(0, 500));
}
