//! PayrollRails Voucher Contract
//!
//! Allows an issuer to create USDC vouchers that walletless recipients
//! can claim later by supplying a Stellar address.
//!
//! Functions:
//!   create(ref, amount_stroops, claimer_hash, expiry_ledger)
//!   claim(ref, recipient)
//!   reclaim(ref)
//!   get(ref) -> VoucherState

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, Bytes, BytesN, Env, String,
    symbol_short, panic_with_error,
};

// ── Error codes ───────────────────────────────────────────────────────────────
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VoucherError {
    AlreadyExists   = 1,
    NotFound        = 2,
    AlreadyClaimed  = 3,
    AlreadyReclaimed = 4,
    Expired         = 5,
    Unauthorized    = 6,
    InvalidHash     = 7,
}

// ── Data types ────────────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum VoucherStatus {
    Unclaimed,
    Claimed,
    Reclaimed,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct VoucherState {
    pub issuer:        Address,
    pub amount:        i128,      // in USDC stroops (7 decimals)
    pub claimer_hash:  BytesN<32>, // SHA-256 of recipient email or ref
    pub expiry_ledger: u32,
    pub status:        VoucherStatus,
    pub claimed_by:    Option<Address>,
}

// ── Storage keys ──────────────────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Voucher(Bytes),   // ref -> VoucherState
    Admin,
}

// ── Contract ──────────────────────────────────────────────────────────────────
#[contract]
pub struct VoucherContract;

#[contractimpl]
impl VoucherContract {
    /// Initialize with an admin (issuer) address.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, VoucherError::AlreadyExists);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Create a new voucher.
    /// - ref_id:        unique reference bytes (UUID or hash)
    /// - amount:        USDC amount in stroops
    /// - claimer_hash:  SHA-256 of recipient email (off-chain verification)
    /// - expiry_ledger: ledger sequence after which voucher expires
    pub fn create(
        env:           Env,
        ref_id:        Bytes,
        amount:        i128,
        claimer_hash:  BytesN<32>,
        expiry_ledger: u32,
    ) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let key = DataKey::Voucher(ref_id.clone());
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, VoucherError::AlreadyExists);
        }

        let state = VoucherState {
            issuer: admin,
            amount,
            claimer_hash,
            expiry_ledger,
            status: VoucherStatus::Unclaimed,
            claimed_by: None,
        };

        env.storage().persistent().set(&key, &state);
        env.events().publish(
            (symbol_short!("voucher"), symbol_short!("created")),
            ref_id,
        );
    }

    /// Recipient claims the voucher by providing their Stellar address.
    /// The contract records the claim; actual USDC transfer is handled
    /// off-chain by the PayrollRails engine.
    pub fn claim(env: Env, ref_id: Bytes, recipient: Address) {
        recipient.require_auth();

        let key = DataKey::Voucher(ref_id.clone());
        let mut state: VoucherState = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, VoucherError::NotFound));

        match state.status {
            VoucherStatus::Claimed   => panic_with_error!(&env, VoucherError::AlreadyClaimed),
            VoucherStatus::Reclaimed => panic_with_error!(&env, VoucherError::AlreadyReclaimed),
            VoucherStatus::Expired   => panic_with_error!(&env, VoucherError::Expired),
            VoucherStatus::Unclaimed => {}
        }

        if env.ledger().sequence() > state.expiry_ledger {
            state.status = VoucherStatus::Expired;
            env.storage().persistent().set(&key, &state);
            panic_with_error!(&env, VoucherError::Expired);
        }

        state.status = VoucherStatus::Claimed;
        state.claimed_by = Some(recipient.clone());
        env.storage().persistent().set(&key, &state);

        env.events().publish(
            (symbol_short!("voucher"), symbol_short!("claimed")),
            (ref_id, recipient),
        );
    }

    /// Issuer reclaims an unclaimed voucher (e.g. after expiry).
    pub fn reclaim(env: Env, ref_id: Bytes) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let key = DataKey::Voucher(ref_id.clone());
        let mut state: VoucherState = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, VoucherError::NotFound));

        if let VoucherStatus::Claimed = state.status {
            panic_with_error!(&env, VoucherError::AlreadyClaimed);
        }

        state.status = VoucherStatus::Reclaimed;
        env.storage().persistent().set(&key, &state);

        env.events().publish(
            (symbol_short!("voucher"), symbol_short!("reclaimed")),
            ref_id,
        );
    }

    /// Read voucher state (view function).
    pub fn get(env: Env, ref_id: Bytes) -> VoucherState {
        let key = DataKey::Voucher(ref_id);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, VoucherError::NotFound))
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Bytes, BytesN, Env};

    fn setup() -> (Env, Address, VoucherContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let contract_id = env.register_contract(None, VoucherContract);
        let client = VoucherContractClient::new(&env, &contract_id);
        client.initialize(&admin);
        (env, admin, client)
    }

    fn make_ref(env: &Env, s: &str) -> Bytes {
        Bytes::from_slice(env, s.as_bytes())
    }

    fn make_hash(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[0u8; 32])
    }

    #[test]
    fn test_create_and_claim() {
        let (env, _admin, client) = setup();
        let ref_id = make_ref(&env, "voucher-001");
        let recipient = Address::generate(&env);

        client.create(&ref_id, &1_000_000_0, &make_hash(&env), &9999);

        let state = client.get(&ref_id);
        assert_eq!(state.status, VoucherStatus::Unclaimed);

        client.claim(&ref_id, &recipient);

        let state = client.get(&ref_id);
        assert_eq!(state.status, VoucherStatus::Claimed);
        assert_eq!(state.claimed_by, Some(recipient));
    }

    #[test]
    fn test_reclaim() {
        let (env, _admin, client) = setup();
        let ref_id = make_ref(&env, "voucher-002");

        client.create(&ref_id, &500_000_0, &make_hash(&env), &9999);
        client.reclaim(&ref_id);

        let state = client.get(&ref_id);
        assert_eq!(state.status, VoucherStatus::Reclaimed);
    }

    #[test]
    #[should_panic]
    fn test_double_claim_fails() {
        let (env, _admin, client) = setup();
        let ref_id = make_ref(&env, "voucher-003");
        let recipient = Address::generate(&env);

        client.create(&ref_id, &100_000_0, &make_hash(&env), &9999);
        client.claim(&ref_id, &recipient);
        client.claim(&ref_id, &recipient); // should panic
    }
}
