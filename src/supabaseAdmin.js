/**
 * Backend Supabase client - used to write real crop health escalation
 * tickets (e.g. when a diagnosis needs Rythu Seva Kendra follow-up).
 *
 * Uses the same Supabase project as the frontend. Set these as
 * environment variables before starting the server:
 *   SUPABASE_URL=https://xxxxx.supabase.co
 *   SUPABASE_ANON_KEY=your-anon-key
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.warn(
    'SUPABASE_URL / SUPABASE_ANON_KEY not set - crop health escalation tickets will not be saved.'
  );
}

/**
 * Inserts a real escalation ticket into the crop_health_reports table.
 * Run supabase_crop_health_table.sql in your Supabase SQL Editor first.
 */
async function createEscalationTicket(diagnosis, farmerEmail) {
  if (!supabase) {
    throw new Error('Supabase is not configured on the backend (missing SUPABASE_URL / SUPABASE_ANON_KEY).');
  }

  const { data, error } = await supabase
    .from('crop_health_reports')
    .insert({
      farmer_email: farmerEmail || null,
      crop_identified: diagnosis.crop_identified,
      issue: diagnosis.issue,
      severity: diagnosis.severity,
      confidence: diagnosis.confidence,
      remedy: diagnosis.remedy,
      reasoning: diagnosis.reasoning,
      escalated: true,
      escalation_reason: diagnosis.escalationReason,
      status: 'open',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create escalation ticket: ${error.message}`);
  }

  return data;
}

module.exports = { createEscalationTicket };
