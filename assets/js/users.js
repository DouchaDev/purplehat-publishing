// ── assets/js/users.js — Vue application for the Users page ──────────────────
//
// Mounts on <section id="app"> in users.html.
// Requires the user to be authenticated AND have role 'admin'.
// Fetches users from GET /api/users (protected route — sends Bearer token).
// Allows admins to change other users' roles via PATCH /api/users/:id/role.
// ─────────────────────────────────────────────────────────────────────────────

// NOTE: auth.js (loaded before this file) already declares:
//   const { createApp, ref, computed } = Vue;
// at the top level. Regular <script> tags share global scope, so re-declaring
// those same names with const would throw "already been declared".
// Solution: use Vue.createApp / Vue.ref / Vue.computed directly here instead.

const USERS_API = 'http://localhost:3000';

// Reuse the same JWT decoder as main.js — both are plain browser scripts
// so there's no import/export here, just a local function with the same logic.
function decodeJwtPayload(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch { return null; }
}

// Returns { token, user } if a valid, unexpired token exists, otherwise null.
function getStoredAuth() {
  const token = localStorage.getItem('ph_token');
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload || payload.exp * 1000 < Date.now()) {
    localStorage.removeItem('ph_token');
    return null;
  }
  return { token, user: payload };
}

Vue.createApp({
  setup() {

    // ── REACTIVE STATE ─────────────────────────────────────────────────────────
    const users   = Vue.ref([]);
    const loading = Vue.ref(true);
    const error   = Vue.ref(null);   // null | 'auth_required' | 'forbidden' | 'network'


    // ── COMPUTED ───────────────────────────────────────────────────────────────

    // currentUser — the logged-in admin (decoded from their stored token).
    // Used to identify their own row in the table so we can show a static badge
    // instead of a dropdown (preventing self-demotion).
    const currentUser = Vue.computed(() => getStoredAuth()?.user ?? null);

    // Maps error codes to human-readable messages shown in the template
    const errorMessage = Vue.computed(() => {
      if (error.value === 'auth_required') return 'You must be signed in to view this page.';
      if (error.value === 'forbidden')     return 'This page is for admins only.';
      if (error.value === 'network')       return 'Could not load users. Is the Express server running on port 3000?';
      return 'An unexpected error occurred.';
    });


    // ── onMounted ─────────────────────────────────────────────────────────────
    //
    // Auth guard: check the token BEFORE making any API call.
    // We check client-side first (fast, no network) and the server enforces it too.
    // The server check is authoritative — even if someone bypasses the client check,
    // the GET /api/users route requires a valid admin token.
    const { onMounted } = Vue;

    onMounted(async () => {
      const auth = getStoredAuth();

      // No token or expired — show sign-in prompt
      if (!auth) {
        error.value   = 'auth_required';
        loading.value = false;
        return;
      }

      // Token exists but user is not admin — show forbidden message
      if (auth.user.role !== 'admin') {
        error.value   = 'forbidden';
        loading.value = false;
        return;
      }

      // Auth checks passed — fetch the users list
      try {
        const response = await fetch(`${USERS_API}/api/users`, {
          // Authorization header — "Bearer " + the JWT token string
          // The server's requireAuth() middleware reads this header,
          // verifies the JWT signature, and checks the role is 'admin'.
          headers: { Authorization: `Bearer ${auth.token}` }
        });

        if (response.status === 401) { error.value = 'auth_required'; return; }
        if (response.status === 403) { error.value = 'forbidden';     return; }
        if (!response.ok) throw new Error(`Status ${response.status}`);

        users.value = await response.json();

      } catch (err) {
        error.value = 'network';
        console.error(err);
      } finally {
        loading.value = false;
      }
    });


    // ── changeRole ────────────────────────────────────────────────────────────
    //
    // Called when the admin changes the dropdown value in a user's row.
    // Sends PATCH /api/users/:id/role with the new role value.
    // On success, updates the local users array so Vue re-renders the row
    // immediately — no need to refetch the whole list.
    async function changeRole(userId, newRole) {
      const auth = getStoredAuth();
      if (!auth) return;

      try {
        const res = await fetch(`${USERS_API}/api/users/${userId}/role`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify({ role: newRole }),
        });

        if (!res.ok) {
          const data = await res.json();
          console.error('Role change failed:', data.error);
          return;
        }

        const updated = await res.json(); // { id, name, role }

        // Find the row in the local array and update it reactively.
        // Vue detects the property change and re-renders only that row.
        const idx = users.value.findIndex(u => u.id === updated.id);
        if (idx !== -1) users.value[idx] = { ...users.value[idx], role: updated.role };

      } catch (err) {
        console.error('changeRole network error:', err);
      }
    }


    return { users, loading, error, errorMessage, currentUser, changeRole };
  }

}).mount('#app');
