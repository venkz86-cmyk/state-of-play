import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

export const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signup(email, password, name);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-24 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Join the insider's desk</h1>
          <p className="text-base text-muted-foreground font-body">Create your account to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" data-testid="signup-form">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium font-body">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-transparent border-b border-border focus:border-primary px-0 py-2 rounded-none focus:ring-0 outline-none transition-colors w-full"
              placeholder="Your name"
              data-testid="input-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium font-body">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-transparent border-b border-border focus:border-primary px-0 py-2 rounded-none focus:ring-0 outline-none transition-colors w-full"
              placeholder="your@email.com"
              data-testid="input-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium font-body">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-transparent border-b border-border focus:border-primary px-0 py-2 rounded-none focus:ring-0 outline-none transition-colors w-full"
              placeholder="••••••••"
              data-testid="input-password"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-none bg-primary text-white hover:bg-primary/90 font-medium uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            data-testid="btn-signup-submit"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground font-body mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};
