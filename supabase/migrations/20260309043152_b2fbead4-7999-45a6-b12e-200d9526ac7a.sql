
-- User credit balances
CREATE TABLE public.user_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'none',
  tier_credits_monthly NUMERIC NOT NULL DEFAULT 0,
  subscription_start DATE,
  subscription_end DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Credit transaction history
CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL DEFAULT 'purchase',
  description TEXT,
  payment_method TEXT,
  payment_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- user_credits policies
CREATE POLICY "Users can view own credits" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credits" ON public.user_credits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own credits" ON public.user_credits FOR UPDATE USING (auth.uid() = user_id);

-- credit_transactions policies
CREATE POLICY "Users can view own transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.credit_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE ON public.user_credits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
