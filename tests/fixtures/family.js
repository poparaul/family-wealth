// Date FICTIVE pentru teste (nume și sume inventate). Datele calendaristice sunt relative la `now`,
// ca testele cu scadențe să funcționeze în orice zi.
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function addDays(now, n) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.setDate(d.getDate() + n); return iso(d); }

function makeFamily(now = new Date()) {
  const split = (id, pct = 100) => ({ member_id: id, percentage: pct });
  return {
    metadata: { version: '1.2.0', base_currency: 'RON', exchange_rates: { EUR: 5, USD: 4.5 }, last_updated: new Date(now.getTime() - 86400000).toISOString() },
    family_members: [
      { id: 'm_a', name: 'Andrei', role: 'admin' },
      { id: 'm_i', name: 'Ioana', role: 'admin' },
      { id: 'm_k', name: 'Mara', role: 'viewer_restricted' },
      { id: 'm_g', name: 'Bunica Elena', role: 'viewer' }
    ],
    investment_accounts: [
      { id: 'inv_t212', platform: 'Trading 212', account_type: 'Acțiuni', total_value: 30000, currency: 'USD', notes: '', splits: [split('m_a')] },
      { id: 'inv_ibkr', platform: 'Interactive Brokers (IBKR)', account_type: 'Acțiuni', total_value: 4000, currency: 'USD', notes: '', splits: [split('m_a')] },
      { id: 'inv_xtb', platform: 'XTB', account_type: 'Acțiuni', total_value: 200, currency: 'EUR', notes: '', splits: [split('m_a')] },
      { id: 'inv_fid_k', platform: 'Tradeville', account_type: 'Titluri de stat (Fidelis / Tezaur)', total_value: 6000, currency: 'EUR', notes: '',
        interest_rate: 6.5, maturity_date: addDays(now, 3650 + 40), tax_rate: 0, splits: [split('m_k')] },
      { id: 'inv_fid_c', platform: 'Tradeville', account_type: 'Titluri de stat (Fidelis / Tezaur)', total_value: 20000, currency: 'EUR', notes: 'comun',
        splits: [split('m_i', 15), split('m_g', 85)] },
      { id: 'inv_rev', platform: 'Revolut', account_type: 'Acțiuni internaționale', total_value: 1000, currency: 'EUR', notes: '', splits: [split('m_i')] },
      { id: 'inv_btc', platform: 'Robinhood', account_type: 'Crypto (Bitcoin, Ethereum etc.)', total_value: 2000, currency: 'USD', notes: '', splits: [split('m_a')] }
    ],
    grandparents_accounts: [
      { id: 'bank_rf', bank_name: 'Raiffeisen Bank', account_type: 'Depozit la termen', owner_id: 'm_a', iban_or_account: '', principal_amount: 30000,
        interest_rate: 6, start_date: addDays(now, -360), maturity_date: addDays(now, 5), tax_rate: 10, maturity_value: null, currency: 'RON', notes: '', splits: [split('m_a')] },
      { id: 'bank_bt_k', bank_name: 'Banca Transilvania (BT)', account_type: 'Cont de economii', owner_id: 'm_k', iban_or_account: '', principal_amount: 10000,
        interest_rate: 0, start_date: null, maturity_date: null, tax_rate: 10, maturity_value: null, currency: 'RON', notes: '', splits: [split('m_k')] },
      { id: 'bank_rf_i', bank_name: 'Raiffeisen Bank', account_type: 'Depozit la termen (pe contul lui Andrei)', owner_id: 'm_a', iban_or_account: '', principal_amount: 14000,
        interest_rate: 5, start_date: addDays(now, -100), maturity_date: addDays(now, 80), tax_rate: 10, maturity_value: null, currency: 'RON', notes: '', splits: [split('m_i')] },
      { id: 'bank_rev_i', bank_name: 'Revolut', account_type: 'Cont de economii', owner_id: 'm_i', iban_or_account: '', principal_amount: 600,
        interest_rate: 0, start_date: null, maturity_date: null, tax_rate: 10, maturity_value: null, currency: 'EUR', notes: '', splits: [split('m_i')] }
    ],
    real_estate: [],
    children_savings: [
      { id: 'child_k', child_id: 'm_k', account_type: 'Cont Centenar Trezorerie', iban: '', current_balance: 5000, currency: 'RON',
        monthly_contribution: { target_amount: 100, due_day: 1, is_paid_this_month: false, last_payment_date: null },
        government_bonus_tracker: { yearly_target: 1200, yearly_deposited: 600, bonus_eligible: false, bonus_amount: 600 },
        tracker_year: now.getFullYear(), balance_history: [] }
    ],
    vehicles: [
      { id: 'veh_1', name: 'Dacia Logan', plate_number: 'B 01 ABC', owner_id: 'm_a', estimated_market_value: 40000, currency: 'RON',
        documents: { rca: { expiration_date: addDays(now, 20), cost: 900 }, itp: { expiration_date: addDays(now, 200) } } }
    ],
    goals: [],
    history: [],
    changelog: [],
    emergency_guide: { instructions: 'Instrucțiuni de test', trusted_contacts: [] }
  };
}

module.exports = { makeFamily, addDays, iso };
