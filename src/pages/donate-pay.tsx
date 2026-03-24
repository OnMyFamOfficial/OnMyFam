import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Heart, ArrowLeft, Lock, Shield } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useAuth } from "@/components/auth/auth-provider";
import { supabase } from "@/lib/supabase";

const stripePromise = loadStripe("pk_test_51TDv5ZDYHNTvaMGsshJwS6emZdRmPns66qb0kng9rxhS9dELXir210KZ2ScO14GKZST28XmmD8U73mfVuywURSNO00HyNL1WbT");

function PaymentForm({ amount, userId, donorName }: { amount: number; userId: string; donorName: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        payment_method_data: {
          billing_details: {
            name: donorName,
          },
        },
        return_url: window.location.origin + "/donate/thankyou",
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message || "Payment failed");
      setProcessing(false);
    } else if (paymentIntent?.status === "succeeded") {
      // Record donation directly in Supabase
      await supabase.from("donations").upsert({
        stripe_session_id: paymentIntent.id,
        amount,
        donor_name: donorName,
        user_id: userId || null,
        payment_method: paymentIntent.payment_method_types?.[0] || "card",
        status: "completed",
      }, { onConflict: "stripe_session_id" });

      navigate("/donate/thankyou?payment_intent=" + paymentIntent.id);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement
        onReady={() => setReady(true)}
        options={{
          layout: {
            type: "accordion",
            defaultCollapsed: false,
            radios: true,
            spacedAccordionItems: true,
          },
        }}
      />

      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
      )}

      {/* Pay button */}
      <button
        type="submit"
        disabled={!stripe || processing || !ready}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-base transition-all cursor-pointer hover:brightness-105 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: "linear-gradient(135deg, #f8e8a0, #f5b8d0, #c8b8f5, #a0e8f0, #b0f0c8, #f5b8d0)",
          color: "#2e303f",
        }}
      >
        <Lock className="w-4 h-4" />
        {processing ? "Processing..." : `Pay $${amount}`}
      </button>

      {/* Security note */}
      <div className="flex items-center justify-center gap-2 text-[10px] text-[var(--muted-foreground)]">
        <Shield className="w-3 h-3" />
        <span>Secured by Stripe. Your card info never touches our servers.</span>
      </div>
    </form>
  );
}

export default function DonatePayPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const amount = Number(searchParams.get("amount")) || 25;
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function createIntent() {
      try {
        const res = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            donorName: profile?.display_name || "Anonymous",
            userId: user?.id || "",
          }),
        });
        const data = await res.json();
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          setError("Failed to initialize payment. Please try again.");
        }
      } catch {
        setError("Connection error. Please try again.");
      }
      setLoading(false);
    }
    createIntent();
  }, [amount]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back link */}
        <button
          onClick={() => navigate("/donate")}
          className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to campaign
        </button>

        {/* Payment card */}
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-2xl">
          {/* Header */}
          <div
            className="px-8 py-6 text-center"
            style={{ background: "linear-gradient(135deg, #1a1040, #2d1060, #401a80)" }}
          >
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3 backdrop-blur-sm border border-white/20">
              <Heart className="w-7 h-7 text-pink-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Donate to OnMyFam</h1>
            <p className="text-3xl font-bold text-white mt-2">${amount}</p>
          </div>

          {/* Payment form */}
          <div className="p-8">
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-[var(--muted-foreground)]">Setting up secure payment...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-sm text-red-400 mb-4">{error}</p>
                <button
                  onClick={() => navigate("/donate")}
                  className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm hover:bg-[var(--accent)] transition-colors cursor-pointer"
                >
                  Go back
                </button>
              </div>
            ) : clientSecret ? (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "night",
                    variables: {
                      colorPrimary: "#d4a843",
                      colorBackground: "#0b1016",
                      colorText: "#e0e0e0",
                      colorDanger: "#ef4444",
                      fontFamily: "Inter, system-ui, sans-serif",
                      borderRadius: "12px",
                    },
                  },
                }}
              >
                <PaymentForm amount={amount} userId={user?.id || ""} donorName={profile?.display_name || "Anonymous"} />
              </Elements>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
