// Supabase Edge Function: challenge-cron
// Finalizes expired challenges by calling finalize_expired_challenges() RPC.
// Scans active challenges past their end_date and sets status to completed/failed.
//
// Intended to be called by a cron schedule (pg_cron or external scheduler).
// No auth required — uses service role key internally.
//
// Deployment: supabase functions deploy challenge-cron

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await supabase.rpc('finalize_expired_challenges');

    if (error) {
      console.error('finalize_expired_challenges error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const finalized = data?.finalized ?? 0;
    const cancelled = data?.cancelled ?? 0;
    console.log(`Challenge cron: finalized ${finalized}, cancelled ${cancelled} challenges`);

    return new Response(
      JSON.stringify({ success: true, finalized, cancelled }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Challenge cron error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
