import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import axios from 'axios';
import { toast } from 'sonner';
import useRazorpay from 'react-razorpay';
import { Calendar, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const Dashboard = () => {
  const { user, fetchUser } = useAuth();
  const navigate = useNavigate();
  const [Razorpay] = useRazorpay();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchSubscriptionStatus();
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

  const handleSubscribe = async () => {
    try {
      const orderResponse = await axios.post(`${API}/payment/create-order`, {
        amount: 99900,
        currency: 'INR'
      });

      const options = {
        key: orderResponse.data.key_id,
        amount: orderResponse.data.amount,
        currency: orderResponse.data.currency,
        order_id: orderResponse.data.order_id,
        name: 'The State of Play',
        description: 'Annual Subscription',
        image: 'https://customer-assets.emergentagent.com/job_leftfield-hub/artifacts/fx9mc000_TSOP-Logo%20Final%3AColour.jpg',
        handler: async (response) => {
          try {
            await axios.post(`${API}/payment/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            toast.success('Subscription activated successfully!');
            await fetchUser();
            await fetchSubscriptionStatus();
          } catch (error) {
            toast.error('Payment verification failed');
          }
        },
        prefill: {
          name: user.name,
          email: user.email
        },
        theme: {
          color: '#2E5AAC'
        }
      };

      const razorpayInstance = new Razorpay(options);
      razorpayInstance.open();
    } catch (error) {
      toast.error('Failed to initiate payment');
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
                <p className="text-base font-medium">{user.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-base font-medium">{user.email}</p>
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
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">No Active Subscription</span>
                  </div>
                  <Button
                    onClick={handleSubscribe}
                    className="w-full mt-4 rounded-none bg-primary text-white hover:bg-primary/90 font-medium uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                    data-testid="btn-dashboard-subscribe"
                  >
                    Subscribe Now - ₹999/year
                  </Button>
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
