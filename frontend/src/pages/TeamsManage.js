import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Loader2, 
  Users, 
  AlertCircle, 
  Check, 
  X,
  Trash2
} from 'lucide-react';

/* =============================================================================
   TEAMS MANAGE DASHBOARD - /teams/manage
   Token-authenticated dashboard for corporate admins to manage team members
   ============================================================================= */

// API Configuration - Replace with actual deployed Apps Script URL
const API_BASE_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL';

export const TeamsManage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [account, setAccount] = useState(null);
  const [members, setMembers] = useState([]);
  
  // Form state
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Remove modal state
  const [removingMember, setRemovingMember] = useState(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  // Fetch account data on mount
  useEffect(() => {
    if (!token) {
      setError('Invalid access link. Please check your email for the correct dashboard link.');
      setLoading(false);
      return;
    }

    fetchAccountData();
  }, [token]);

  // Fetch account and members data
  const fetchAccountData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}?token=${encodeURIComponent(token)}`);
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Invalid access link. Please check your email for the correct dashboard link.');
        return;
      }

      setAccount(data.data.account);
      setMembers(data.data.members || []);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Unable to connect. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Validate email format
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle email input change
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setNewEmail(value);
    setEmailError('');
    setSuccessMessage('');
  };

  // Handle email input blur
  const handleEmailBlur = () => {
    if (newEmail && !validateEmail(newEmail)) {
      setEmailError('Please enter a valid email address');
    }
  };

  // Add member
  const handleAddMember = async (e) => {
    e.preventDefault();
    
    // Client-side validation
    if (!newEmail) {
      setEmailError('Please enter an email address');
      return;
    }
    
    if (!validateEmail(newEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    // Check if seats are full
    if (members.length >= account.seats) {
      setEmailError(`All ${account.seats} seats are filled. Remove a member to add a new one.`);
      return;
    }

    try {
      setAddingMember(true);
      setEmailError('');
      setSuccessMessage('');

      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'add_member',
          token: token,
          email: newEmail.toLowerCase().trim()
        })
      });

      const data = await response.json();

      if (!data.success) {
        setEmailError(data.error || 'Failed to add member. Please try again.');
        return;
      }

      // Success - refresh data and show message
      setSuccessMessage(`Added ${newEmail}. They'll receive a login link via email.`);
      setNewEmail('');
      
      // Refresh member list
      await fetchAccountData();

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);

    } catch (err) {
      console.error('Add member error:', err);
      setEmailError('Unable to connect. Please check your connection and try again.');
    } finally {
      setAddingMember(false);
    }
  };

  // Remove member
  const handleRemoveMember = async () => {
    if (!removingMember) return;

    try {
      setRemoveLoading(true);

      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'remove_member',
          token: token,
          member_id: removingMember.member_id
        })
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to remove member. Please try again.');
        setRemovingMember(null);
        return;
      }

      // Success - refresh data
      setRemovingMember(null);
      await fetchAccountData();

    } catch (err) {
      console.error('Remove member error:', err);
      setError('Unable to connect. Please check your connection and try again.');
      setRemovingMember(null);
    } finally {
      setRemoveLoading(false);
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Calculate seats info
  const seatsUsed = members.length;
  const seatsTotal = account?.seats || 0;
  const seatsRemaining = seatsTotal - seatsUsed;
  const seatsFull = seatsUsed >= seatsTotal;
  const seatPercentage = seatsTotal > 0 ? (seatsUsed / seatsTotal) * 100 : 0;

  // =========================================================================
  // RENDER: LOADING STATE
  // =========================================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: ERROR STATE
  // =========================================================================
  if (error && !account) {
    return (
      <div className="min-h-screen bg-background">
        {/* Simplified Header */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="text-xl font-heading font-bold text-primary">
              The State of Play
            </Link>
            <span className="text-muted-foreground font-medium">Team Dashboard</span>
          </div>
        </header>

        <div className="container mx-auto px-4 py-20 max-w-lg text-center">
          <div className="bg-destructive/10 border border-destructive/30 p-8">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-heading font-bold mb-2">Access Error</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link 
              to="/"
              className="inline-flex items-center text-primary hover:underline font-medium"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: MAIN DASHBOARD
  // =========================================================================
  return (
    <div className="min-h-screen bg-muted/30">
      
      {/* =========================================================================
          HEADER
          ========================================================================= */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-heading font-bold text-primary">
            The State of Play
          </Link>
          <span className="text-muted-foreground font-medium">Team Dashboard</span>
        </div>
      </header>

      {/* Global Error Banner */}
      {error && account && (
        <div className="bg-destructive text-white px-4 py-3">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        
        {/* =========================================================================
            ACCOUNT HEADER
            ========================================================================= */}
        <div className="mb-8" data-testid="account-header">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold mb-2">
                {account.company_name}
              </h1>
              <p className="text-muted-foreground">
                {account.plan_name} • {account.seats} seats
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Renews: {formatDate(account.renewal_date)}
              </p>
            </div>
            <div className="flex items-center space-x-2 bg-green-100 text-green-800 px-3 py-1.5 text-sm font-medium">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span>Active</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            SEAT METER CARD
            ========================================================================= */}
        <div 
          className="bg-primary text-white p-6 mb-8"
          data-testid="seat-meter"
        >
          <div className="text-center mb-4">
            <span className="text-4xl md:text-5xl font-heading font-bold">
              {seatsUsed} of {seatsTotal}
            </span>
            <span className="text-xl text-white/80 ml-2">Seats Used</span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-white/20 rounded-full h-3 mb-2">
            <div 
              className={`h-3 rounded-full transition-all duration-500 ${seatsFull ? 'bg-red-500' : 'bg-accent'}`}
              style={{ width: `${Math.min(seatPercentage, 100)}%` }}
            />
          </div>
          
          <p className="text-center text-sm text-white/70">
            {seatsFull 
              ? 'All seats filled. Remove a member to add someone new.' 
              : `${seatsRemaining} seat${seatsRemaining !== 1 ? 's' : ''} remaining`
            }
          </p>
        </div>

        {/* =========================================================================
            ADD MEMBER FORM
            ========================================================================= */}
        <div 
          className="bg-card border border-border p-6 mb-8"
          data-testid="add-member-form"
        >
          <h2 className="text-lg font-heading font-bold mb-4">Add Team Member</h2>
          
          <form onSubmit={handleAddMember}>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="email"
                  value={newEmail}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  placeholder={`colleague@${account.company_domain}`}
                  disabled={addingMember || seatsFull}
                  className={`w-full h-12 px-4 border rounded-none focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    emailError ? 'border-destructive' : 'border-border'
                  } ${seatsFull ? 'bg-muted cursor-not-allowed' : ''}`}
                  data-testid="email-input"
                />
              </div>
              <button
                type="submit"
                disabled={addingMember || seatsFull}
                className={`h-12 px-6 font-bold transition-all duration-300 ${
                  seatsFull 
                    ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                    : 'bg-accent hover:bg-accent/90 text-white'
                }`}
                data-testid="add-member-button"
              >
                {addingMember ? (
                  <span className="flex items-center">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Adding...
                  </span>
                ) : (
                  'Add Member'
                )}
              </button>
            </div>

            {/* Error Message */}
            {emailError && (
              <p className="text-destructive text-sm mt-2 flex items-center" data-testid="email-error">
                <AlertCircle className="w-4 h-4 mr-1" />
                {emailError}
              </p>
            )}

            {/* Success Message */}
            {successMessage && (
              <p className="text-green-600 text-sm mt-2 flex items-center" data-testid="success-message">
                <Check className="w-4 h-4 mr-1" />
                {successMessage}
              </p>
            )}
          </form>

          <p className="text-xs text-muted-foreground mt-3">
            Only emails from <strong>{account.company_domain}</strong> can be added.
          </p>
        </div>

        {/* =========================================================================
            MEMBERS LIST
            ========================================================================= */}
        <div 
          className="bg-card border border-border"
          data-testid="members-list"
        >
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-heading font-bold">
              Team Members ({members.length})
            </h2>
          </div>

          {members.length === 0 ? (
            /* Empty State */
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="font-heading font-bold text-lg mb-2">No team members yet</h3>
              <p className="text-muted-foreground">
                Add your first team member using the form above.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date Added</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member, index) => (
                      <tr 
                        key={member.member_id} 
                        className={index !== members.length - 1 ? 'border-b border-border' : ''}
                        data-testid={`member-row-${index}`}
                      >
                        <td className="p-4 font-medium">{member.email}</td>
                        <td className="p-4 text-muted-foreground">{formatDate(member.added_at)}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setRemovingMember(member)}
                            className="text-destructive hover:text-destructive/80 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-border">
                {members.map((member, index) => (
                  <div 
                    key={member.member_id}
                    className="p-4 flex items-center justify-between"
                    data-testid={`member-card-${index}`}
                  >
                    <div>
                      <p className="font-medium">{member.email}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(member.added_at)}</p>
                    </div>
                    <button
                      onClick={() => setRemovingMember(member)}
                      className="text-destructive hover:text-destructive/80 p-2"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </main>

      {/* =========================================================================
          FOOTER
          ========================================================================= */}
      <footer className="bg-primary text-white mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link to="/" className="text-white/80 hover:text-white">Home</Link>
            <Link to="/contact" className="text-white/80 hover:text-white">Contact</Link>
            <Link to="/privacy" className="text-white/80 hover:text-white">Privacy</Link>
          </div>
        </div>
      </footer>

      {/* =========================================================================
          REMOVE CONFIRMATION MODAL
          ========================================================================= */}
      {removingMember && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !removeLoading && setRemovingMember(null)}
        >
          <div 
            className="bg-card border border-border p-6 max-w-md w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
            data-testid="remove-modal"
          >
            <h3 className="text-xl font-heading font-bold mb-2">
              Remove {removingMember.email}?
            </h3>
            <p className="text-muted-foreground mb-6">
              They will lose access to TSOP immediately. This cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setRemovingMember(null)}
                disabled={removeLoading}
                className="flex-1 border border-border px-4 py-3 font-medium hover:bg-muted transition-colors"
                data-testid="cancel-remove"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                disabled={removeLoading}
                className="flex-1 bg-destructive text-white px-4 py-3 font-medium hover:bg-destructive/90 transition-colors"
                data-testid="confirm-remove"
              >
                {removeLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Removing...
                  </span>
                ) : (
                  'Remove Member'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsManage;
