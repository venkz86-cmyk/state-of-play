import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  User, 
  Calendar, 
  Clock, 
  CreditCard, 
  Mail, 
  Shield, 
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';

const API = process.env.REACT_APP_BACKEND_URL;

export const MemberDashboard = () => {
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [memberDetails, setMemberDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;
    
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    fetchMemberDetails();
  }, [isLoggedIn, authLoading, navigate, user?.email]);

  const fetchMemberDetails = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API}/api/ghost/member-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      
      if (!response.ok) throw new Error('Failed to fetch member details');
      
      const data = await response.json();
      setMemberDetails(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      paid: { label: 'Active Subscriber', variant: 'default', icon: CheckCircle },
      comped: { label: 'Premium Member', variant: 'default', icon: Shield },
      free: { label: 'Free Member', variant: 'secondary', icon: User },
      canceled: { label: 'Subscription Ended', variant: 'destructive', icon: AlertCircle }
    };
    
    const config = statusConfig[status] || statusConfig.free;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="text-sm px-3 py-1">
        <Icon className="h-3.5 w-3.5 mr-1.5" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'MMMM d, yyyy');
    } catch {
      return 'N/A';
    }
  };

  const getSubscriptionStatus = () => {
    if (!memberDetails) return null;
    
    const { subscription_end, subscription_status, status } = memberDetails;
    
    // Comped members with no end date = lifetime access
    if (status === 'comped' && !subscription_end) {
      return {
        message: 'Lifetime premium access',
        type: 'success',
        daysLeft: null
      };
    }
    
    if (!subscription_end) {
      return {
        message: 'No active subscription',
        type: 'warning',
        daysLeft: null
      };
    }
    
    const endDate = new Date(subscription_end);
    const daysLeft = differenceInDays(endDate, new Date());
    
    if (isPast(endDate)) {
      return {
        message: 'Subscription expired',
        type: 'error',
        daysLeft: 0
      };
    }
    
    if (daysLeft <= 30) {
      return {
        message: `Renews in ${daysLeft} days`,
        type: 'warning',
        daysLeft
      };
    }
    
    return {
      message: `${daysLeft} days remaining`,
      type: 'success',
      daysLeft
    };
  };

  // Show loading while auth is loading or data is being fetched
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to load dashboard</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchMemberDetails}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const subscriptionStatus = getSubscriptionStatus();

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
            Member Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage your subscription and account details
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {memberDetails?.avatar_image ? (
                  <img 
                    src={memberDetails.avatar_image} 
                    alt={memberDetails.name || 'Profile'} 
                    className="h-16 w-16 rounded-full object-cover border-2 border-primary/20"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">
                      {(memberDetails?.name || memberDetails?.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-lg">
                    {memberDetails?.name || 'Member'}
                  </h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {memberDetails?.email}
                  </p>
                </div>
              </div>
              
              <div className="pt-2">
                {getStatusBadge(memberDetails?.status)}
              </div>
              
              <div className="text-sm text-muted-foreground">
                <span>Member since </span>
                <span className="text-foreground font-medium">
                  {formatDate(memberDetails?.created_at)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Subscription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Indicator */}
              <div className={`p-4 rounded-lg ${
                subscriptionStatus?.type === 'success' ? 'bg-green-500/10 border border-green-500/20' :
                subscriptionStatus?.type === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/20' :
                'bg-red-500/10 border border-red-500/20'
              }`}>
                <div className="flex items-center gap-2">
                  {subscriptionStatus?.type === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                  {subscriptionStatus?.type === 'warning' && <AlertCircle className="h-5 w-5 text-yellow-500" />}
                  {subscriptionStatus?.type === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                  <span className={`font-medium ${
                    subscriptionStatus?.type === 'success' ? 'text-green-600 dark:text-green-400' :
                    subscriptionStatus?.type === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {subscriptionStatus?.message}
                  </span>
                </div>
              </div>

              {/* Date Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Started
                  </span>
                  <span className="font-medium">
                    {formatDate(memberDetails?.subscription_start)}
                  </span>
                </div>
                
                {memberDetails?.subscription_end && (
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {memberDetails?.subscription_status === 'canceled' ? 'Ends' : 'Renews'}
                    </span>
                    <span className="font-medium">
                      {formatDate(memberDetails?.subscription_end)}
                    </span>
                  </div>
                )}
                
                {!memberDetails?.subscription_end && memberDetails?.status === 'comped' && (
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Access
                    </span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      Lifetime
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {memberDetails?.subscription_status === 'canceled' && (
                <Button 
                  className="w-full mt-4"
                  onClick={() => window.open('https://the-state-of-play.ghost.io/#/portal/account', '_blank')}
                >
                  Renew Subscription
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Benefits Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Your Benefits
              </CardTitle>
              <CardDescription>
                What's included in your membership
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { icon: CheckCircle, text: 'Full access to The State of Play articles' },
                  { icon: CheckCircle, text: 'Exclusive deep-dive analysis' },
                  { icon: CheckCircle, text: 'Premium interviews & insights' },
                  { icon: CheckCircle, text: 'Early access to new features' },
                  { icon: CheckCircle, text: 'Ad-free reading experience' },
                  { icon: CheckCircle, text: 'Members-only newsletter' },
                ].map((benefit, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <benefit.icon className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{benefit.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button 
                  variant="outline"
                  onClick={() => window.open('https://the-state-of-play.ghost.io/#/portal/account', '_blank')}
                >
                  Manage Account
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate('/state-of-play')}
                >
                  Browse Premium Articles
                </Button>
                <Button 
                  variant="outline"
                  onClick={fetchMemberDetails}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MemberDashboard;
