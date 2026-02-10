import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { RazorpayButton } from '../components/RazorpayButton';
import axios from 'axios';
import { Calendar, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchSubscriptionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await axios.get(`${API}/user/subscription`);
      setSubscription(response.data);
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground font-body">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-24">
      <div className="container mx-auto px-4 md:px-8 max-w-4xl">
        <div className="mb-12">
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Dashboard</h1>
          <p className="text-base text-muted-foreground font-body">Manage your account and subscription</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-card border border-border/50 p-8 shadow-sm rounded-sm">
            <h2 className="text-xl font-heading font-semibold mb-4">Account Details</h2>
            <div className="space-y-3 font-body">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="text-base font-medium">{user?.name || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-base font-medium">{user?.email || 'Not provided'}</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/50 p-8 shadow-sm rounded-sm" data-testid="subscription-status-card">
            <h2 className="text-xl font-heading font-semibold mb-4">Subscription Status</h2>
            <div className="space-y-4 font-body">
              {subscription?.is_active ? (
                <>
                  <div className="flex items-center space-x-2 text-secondary">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Active Subscriber</span>
                  </div>
                  {subscription.subscription_end_date && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Valid until {format(new Date(subscription.subscription_end_date), 'MMM dd, yyyy')}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-2 text-muted-foreground mb-4">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">No Active Subscription</span>
                  </div>
                  <RazorpayButton />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 p-8 rounded-sm">
          <h3 className="text-2xl font-heading font-semibold mb-3">Premium Benefits</h3>
          <ul className="space-y-2 font-body text-foreground/80">
            <li className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span>Unlimited access to all premium articles</span>
            </li>
            <li className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span>Exclusive deep dives and analysis</span>
            </li>
            <li className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span>Early access to breaking stories</span>
            </li>
            <li className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span>Newsletter delivered to your inbox</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
