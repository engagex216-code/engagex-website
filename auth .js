/**
 * EngageX Auth System — auth.js
 * Shared across all pages: index, order, payment, confirmation, dashboard
 */

const Auth = (() => {

  const USERS_KEY   = 'engagex_users';
  const SESSION_KEY = 'engagex_session';
  const SHEET_URL   = 'https://script.google.com/macros/s/AKfycbxrVEAedDSdBTMSDgaJxvlaokVD44cZxiEQMqGTUL5hZK26IRgaUSD-QH4x7XUXRj-LXg/exec';

  // ── Storage helpers ──────────────────────────────────────────
  function getUsers()   { return JSON.parse(localStorage.getItem(USERS_KEY)   || '[]'); }
  function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
  function getUser()    { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  function saveSession(u){ localStorage.setItem(SESSION_KEY, JSON.stringify(u)); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }
  function isLoggedIn() { return !!getUser(); }

  function initials(name) {
    return (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  // ── Save order to user profile ───────────────────────────────
  function addOrder(order) {
    const user = getUser();
    if (!user) return;
    const users = getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx === -1) return;
    if (!users[idx].orders) users[idx].orders = [];
    users[idx].orders.unshift(order);
    saveUsers(users);
    saveSession(users[idx]);
  }

  // ── Logout ───────────────────────────────────────────────────
  function logout() {
    clearSession();
    renderNavAuth();
  }

  // ── Google Sheet sync (fire & forget) ───────────────────────
  async function syncToSheet(data) {
    try {
      await fetch(SHEET_URL, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch(e) { console.warn('Sheet sync failed:', e); }
  }

  // ── Render nav auth area ─────────────────────────────────────
  function renderNavAuth() {
    const el = document.getElementById('navAuthArea');
    if (!el) return;
    const user = getUser();
    if (user) {
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <div style="width:30px;height:30px;border-radius:50%;background:#F5C842;color:#000;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;">${initials(user.name)}</div>
          <span style="font-size:13px;font-weight:600;color:#F5C842;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${user.name.split(' ')[0]}</span>
          <button onclick="Auth.goToDashboard()" style="padding:6px 12px;border-radius:7px;font-size:12px;font-weight:600;border:1.5px solid #F5C842;color:#F5C842;background:transparent;cursor:pointer;font-family:inherit;transition:all .18s;" onmouseover="this.style.background='rgba(245,200,66,0.08)'" onmouseout="this.style.background='transparent'">Dashboard</button>
          <button onclick="Auth.logout()" style="padding:6px 12px;border-radius:7px;font-size:12px;font-weight:600;border:1.5px solid #444;color:#999;background:transparent;cursor:pointer;font-family:inherit;transition:all .18s;" onmouseover="this.style.borderColor='#ef4444';this.style.color='#ef4444'" onmouseout="this.style.borderColor='#444';this.style.color='#999'">Logout</button>
        </div>
      `;
    } else {
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <button onclick="Auth.openModal('login')" style="padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;border:1.5px solid rgba(212,160,23,0.4);color:#F5C842;background:transparent;cursor:pointer;font-family:inherit;transition:all .18s;" onmouseover="this.style.background='rgba(212,160,23,0.08)'" onmouseout="this.style.background='transparent'">Login</button>
          <button onclick="Auth.openModal('register')" style="padding:8px 16px;border-radius:8px;font-size:13px;font-weight:700;border:none;color:#000;background:#F5C842;cursor:pointer;font-family:inherit;transition:all .18s;" onmouseover="this.style.background='#ffd700'" onmouseout="this.style.background='#F5C842'">Register</button>
        </div>
      `;
    }
  }

  function goToDashboard() { window.location.href = 'dashboard.html'; }

  // ── Modal HTML (injected once) ───────────────────────────────
  function injectModal() {
    if (document.getElementById('exAuthOverlay')) return;
    const html = `
    <!-- GATE MODAL -->
    <div id="exGateOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:9999;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px);">
      <div style="background:#111;border-radius:20px;width:100%;max-width:370px;overflow:hidden;border:1px solid #222;box-shadow:0 32px 80px rgba(0,0,0,0.8);text-align:center;">
        <div style="background:#0d0d0d;padding:32px 26px 24px;border-bottom:1px solid #1e1e1e;">
          <div style="font-size:40px;margin-bottom:12px;">🔐</div>
          <h3 style="font-size:18px;font-weight:800;color:#fff;margin-bottom:6px;">Login or Register to Continue</h3>
          <p id="exGateMsg" style="font-size:13px;color:#666;line-height:1.6;">Please login or create an account to place an order.</p>
        </div>
        <div style="padding:20px 26px;display:flex;flex-direction:column;gap:10px;">
          <button onclick="Auth._gateLogin()" style="padding:12px;border-radius:10px;font-size:14px;font-weight:800;border:none;color:#000;background:#F5C842;cursor:pointer;font-family:inherit;">Login to Your Account</button>
          <button onclick="Auth._gateRegister()" style="padding:12px;border-radius:10px;font-size:14px;font-weight:700;border:1.5px solid #333;color:#ccc;background:transparent;cursor:pointer;font-family:inherit;">Create New Account</button>
          <button onclick="Auth.closeModal()" style="font-size:12px;color:#555;background:none;border:none;cursor:pointer;font-family:inherit;padding:4px;">Cancel</button>
        </div>
      </div>
    </div>

    <!-- AUTH MODAL -->
    <div id="exAuthOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:9999;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px);">
      <div style="background:#111;border-radius:20px;width:100%;max-width:430px;overflow:hidden;border:1px solid #222;box-shadow:0 32px 80px rgba(0,0,0,0.8);">
        <div style="background:#0d0d0d;padding:26px 26px 18px;text-align:center;position:relative;border-bottom:1px solid #1e1e1e;">
          <button onclick="Auth.closeModal()" style="position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:50%;background:#222;border:none;color:#888;font-size:13px;cursor:pointer;">✕</button>
          <div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:3px;letter-spacing:-1px;">Engage<span style="color:#F5C842;">X</span></div>
          <div id="exAuthSub" style="font-size:12px;color:#555;">India's #1 Review & Local SEO Agency</div>
        </div>
        <div style="display:flex;border-bottom:1px solid #1e1e1e;background:#0d0d0d;">
          <button id="exTabLogin" onclick="Auth.switchTab('login')" style="flex:1;padding:13px;font-size:14px;font-weight:600;border:none;background:transparent;color:#F5C842;cursor:pointer;border-bottom:2px solid #F5C842;font-family:inherit;">Login</button>
          <button id="exTabRegister" onclick="Auth.switchTab('register')" style="flex:1;padding:13px;font-size:14px;font-weight:600;border:none;background:transparent;color:#555;cursor:pointer;border-bottom:2px solid transparent;font-family:inherit;">Register</button>
        </div>
        <div style="padding:22px 26px;">
          <div id="exFormError" style="display:none;background:#1a0000;border:1px solid #3f0000;border-radius:8px;padding:9px 13px;font-size:13px;color:#ef4444;margin-bottom:12px;"></div>
          <div id="exFormSuccess" style="display:none;background:#001a00;border:1px solid #003f00;border-radius:8px;padding:9px 13px;font-size:13px;color:#22c55e;margin-bottom:12px;"></div>

          <!-- LOGIN FORM -->
          <div id="exLoginForm">
            <div style="margin-bottom:14px;">
              <label style="display:block;font-size:12px;font-weight:600;color:#777;margin-bottom:5px;">Email Address</label>
              <input type="email" id="exLoginEmail" placeholder="you@example.com" onkeydown="if(event.key==='Enter')Auth._doLogin()" style="width:100%;padding:10px 13px;border-radius:8px;border:1.5px solid #222;font-size:14px;color:#fff;outline:none;background:#0d0d0d;font-family:inherit;" onfocus="this.style.borderColor='#F5C842'" onblur="this.style.borderColor='#222'"/>
              <div id="exErrLoginEmail" style="display:none;font-size:11px;color:#ef4444;margin-top:3px;"></div>
            </div>
            <div style="margin-bottom:14px;">
              <label style="display:block;font-size:12px;font-weight:600;color:#777;margin-bottom:5px;">Password</label>
              <input type="password" id="exLoginPassword" placeholder="Your password" onkeydown="if(event.key==='Enter')Auth._doLogin()" style="width:100%;padding:10px 13px;border-radius:8px;border:1.5px solid #222;font-size:14px;color:#fff;outline:none;background:#0d0d0d;font-family:inherit;" onfocus="this.style.borderColor='#F5C842'" onblur="this.style.borderColor='#222'"/>
              <div id="exErrLoginPwd" style="display:none;font-size:11px;color:#ef4444;margin-top:3px;"></div>
            </div>
            <button onclick="Auth._doLogin()" style="width:100%;padding:12px;border-radius:10px;font-size:15px;font-weight:800;border:none;color:#000;background:#F5C842;cursor:pointer;font-family:inherit;box-shadow:0 4px 20px rgba(212,160,23,0.3);" id="exLoginBtn">Sign In</button>
            <p style="text-align:center;font-size:13px;color:#555;margin-top:14px;">No account? <button onclick="Auth.switchTab('register')" style="color:#F5C842;background:none;border:none;cursor:pointer;font-weight:600;font-size:13px;text-decoration:underline;font-family:inherit;">Register here</button></p>
          </div>

          <!-- REGISTER FORM -->
          <div id="exRegisterForm" style="display:none;">
            <div style="margin-bottom:14px;">
              <label style="display:block;font-size:12px;font-weight:600;color:#777;margin-bottom:5px;">Full Name</label>
              <input type="text" id="exRegName" placeholder="Rahul Sharma" style="width:100%;padding:10px 13px;border-radius:8px;border:1.5px solid #222;font-size:14px;color:#fff;outline:none;background:#0d0d0d;font-family:inherit;" onfocus="this.style.borderColor='#F5C842'" onblur="this.style.borderColor='#222'"/>
              <div id="exErrRegName" style="display:none;font-size:11px;color:#ef4444;margin-top:3px;"></div>
            </div>
            <div style="margin-bottom:14px;">
              <label style="display:block;font-size:12px;font-weight:600;color:#777;margin-bottom:5px;">Email Address</label>
              <input type="email" id="exRegEmail" placeholder="you@example.com" style="width:100%;padding:10px 13px;border-radius:8px;border:1.5px solid #222;font-size:14px;color:#fff;outline:none;background:#0d0d0d;font-family:inherit;" onfocus="this.style.borderColor='#F5C842'" onblur="this.style.borderColor='#222'"/>
              <div id="exErrRegEmail" style="display:none;font-size:11px;color:#ef4444;margin-top:3px;"></div>
            </div>
            <div style="margin-bottom:14px;">
              <label style="display:block;font-size:12px;font-weight:600;color:#777;margin-bottom:5px;">Phone Number</label>
              <input type="tel" id="exRegPhone" placeholder="+91 98765 43210" style="width:100%;padding:10px 13px;border-radius:8px;border:1.5px solid #222;font-size:14px;color:#fff;outline:none;background:#0d0d0d;font-family:inherit;" onfocus="this.style.borderColor='#F5C842'" onblur="this.style.borderColor='#222'"/>
              <div id="exErrRegPhone" style="display:none;font-size:11px;color:#ef4444;margin-top:3px;"></div>
            </div>
            <div style="margin-bottom:14px;">
              <label style="display:block;font-size:12px;font-weight:600;color:#777;margin-bottom:5px;">Password</label>
              <input type="password" id="exRegPwd" placeholder="Min. 6 characters" style="width:100%;padding:10px 13px;border-radius:8px;border:1.5px solid #222;font-size:14px;color:#fff;outline:none;background:#0d0d0d;font-family:inherit;" onfocus="this.style.borderColor='#F5C842'" onblur="this.style.borderColor='#222'"/>
              <div id="exErrRegPwd" style="display:none;font-size:11px;color:#ef4444;margin-top:3px;"></div>
            </div>
            <div style="margin-bottom:14px;">
              <label style="display:block;font-size:12px;font-weight:600;color:#777;margin-bottom:5px;">Confirm Password</label>
              <input type="password" id="exRegConfirm" placeholder="Re-enter password" onkeydown="if(event.key==='Enter')Auth._doRegister()" style="width:100%;padding:10px 13px;border-radius:8px;border:1.5px solid #222;font-size:14px;color:#fff;outline:none;background:#0d0d0d;font-family:inherit;" onfocus="this.style.borderColor='#F5C842'" onblur="this.style.borderColor='#222'"/>
              <div id="exErrRegConfirm" style="display:none;font-size:11px;color:#ef4444;margin-top:3px;"></div>
            </div>
            <button onclick="Auth._doRegister()" id="exRegisterBtn" style="width:100%;padding:12px;border-radius:10px;font-size:15px;font-weight:800;border:none;color:#000;background:#F5C842;cursor:pointer;font-family:inherit;box-shadow:0 4px 20px rgba(212,160,23,0.3);">Create Account</button>
            <p style="text-align:center;font-size:13px;color:#555;margin-top:14px;">Already registered? <button onclick="Auth.switchTab('login')" style="color:#F5C842;background:none;border:none;cursor:pointer;font-weight:600;font-size:13px;text-decoration:underline;font-family:inherit;">Login here</button></p>
          </div>
        </div>
      </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  // ── Modal show/hide ──────────────────────────────────────────
  let _pending = null;

  function openModal(tab, pendingService) {
    if (pendingService) _pending = pendingService;
    injectModal();
    _clearMsgs();
    switchTab(tab);
    const sub = document.getElementById('exAuthSub');
    if (sub) sub.textContent = pendingService
      ? `Sign in to order "${pendingService}"`
      : "India's #1 Review & Local SEO Agency";
    _show('exAuthOverlay');
  }

  function showGate(serviceName) {
    _pending = serviceName;
    injectModal();
    const msg = document.getElementById('exGateMsg');
    if (msg) msg.innerHTML = `Please login or create an account to order <strong style="color:#F5C842;">"${serviceName}"</strong>.`;
    _show('exGateOverlay');
  }

  function closeModal() {
    _hide('exGateOverlay');
    _hide('exAuthOverlay');
    _pending = null;
    _clearMsgs();
  }

  function _gateLogin()    { _hide('exGateOverlay'); openModal('login', _pending); }
  function _gateRegister() { _hide('exGateOverlay'); openModal('register', _pending); }

  function switchTab(tab) {
    const tl = document.getElementById('exTabLogin');
    const tr = document.getElementById('exTabRegister');
    const fl = document.getElementById('exLoginForm');
    const fr = document.getElementById('exRegisterForm');
    if (!tl) return;
    tl.style.color = tab === 'login' ? '#F5C842' : '#555';
    tl.style.borderBottom = tab === 'login' ? '2px solid #F5C842' : '2px solid transparent';
    tr.style.color = tab === 'register' ? '#F5C842' : '#555';
    tr.style.borderBottom = tab === 'register' ? '2px solid #F5C842' : '2px solid transparent';
    fl.style.display = tab === 'login'    ? 'block' : 'none';
    fr.style.display = tab === 'register' ? 'block' : 'none';
    _clearMsgs();
  }

  function _show(id) { const el = document.getElementById(id); if(el){ el.style.display = 'flex'; } }
  function _hide(id) { const el = document.getElementById(id); if(el){ el.style.display = 'none'; } }

  function _clearMsgs() {
    ['exFormError','exFormSuccess'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.style.display = 'none'; }
    });
    ['exErrLoginEmail','exErrLoginPwd','exErrRegName','exErrRegEmail','exErrRegPhone','exErrRegPwd','exErrRegConfirm'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.style.display = 'none'; }
    });
  }

  function _showErr(msg) {
    const e = document.getElementById('exFormError');
    const s = document.getElementById('exFormSuccess');
    if(e){ e.textContent = msg; e.style.display = 'block'; }
    if(s){ s.style.display = 'none'; }
  }

  function _fieldErr(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
  }

  // ── LOGIN ────────────────────────────────────────────────────
  async function _doLogin() {
    _clearMsgs();
    const email = (document.getElementById('exLoginEmail')?.value || '').trim();
    const pwd   = document.getElementById('exLoginPassword')?.value || '';
    let ok = true;
    if (!email) { _fieldErr('exErrLoginEmail','Email is required'); ok=false; }
    else if (!/\S+@\S+\.\S+/.test(email)) { _fieldErr('exErrLoginEmail','Enter a valid email'); ok=false; }
    if (!pwd)  { _fieldErr('exErrLoginPwd','Password is required'); ok=false; }
    if (!ok) return;

    const btn = document.getElementById('exLoginBtn');
    if(btn){ btn.disabled=true; btn.textContent='Signing in…'; }
    await new Promise(r => setTimeout(r, 600));

    const users = getUsers();
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === pwd);
    if(btn){ btn.disabled=false; btn.textContent='Sign In'; }

    if (!found) { _showErr('Incorrect email or password.'); return; }

    const pending = _pending;
    saveSession(found);
    closeModal();
    renderNavAuth();

    // Redirect to order page if came from one
    const redirect = sessionStorage.getItem('ex_redirect');
    if (redirect) { sessionStorage.removeItem('ex_redirect'); window.location.href = redirect; return; }
    if (pending) window.location.reload();
  }

  // ── REGISTER ────────────────────────────────────────────────
  async function _doRegister() {
    _clearMsgs();
    const name    = (document.getElementById('exRegName')?.value    || '').trim();
    const email   = (document.getElementById('exRegEmail')?.value   || '').trim();
    const phone   = (document.getElementById('exRegPhone')?.value   || '').trim();
    const pwd     = document.getElementById('exRegPwd')?.value      || '';
    const confirm = document.getElementById('exRegConfirm')?.value  || '';
    let ok = true;

    if (!name)  { _fieldErr('exErrRegName','Full name is required'); ok=false; }
    if (!email) { _fieldErr('exErrRegEmail','Email is required'); ok=false; }
    else if (!/\S+@\S+\.\S+/.test(email)) { _fieldErr('exErrRegEmail','Enter a valid email'); ok=false; }
    else if (getUsers().find(u => u.email.toLowerCase() === email.toLowerCase())) { _fieldErr('exErrRegEmail','Email already registered'); ok=false; }
    if (!phone) { _fieldErr('exErrRegPhone','Phone is required'); ok=false; }
    else if (!/^\+?[\d\s\-]{7,15}$/.test(phone)) { _fieldErr('exErrRegPhone','Enter a valid phone number'); ok=false; }
    if (!pwd)   { _fieldErr('exErrRegPwd','Password is required'); ok=false; }
    else if (pwd.length < 6) { _fieldErr('exErrRegPwd','Minimum 6 characters'); ok=false; }
    if (!confirm) { _fieldErr('exErrRegConfirm','Please confirm password'); ok=false; }
    else if (pwd !== confirm) { _fieldErr('exErrRegConfirm','Passwords do not match'); ok=false; }
    if (!ok) return;

    const btn = document.getElementById('exRegisterBtn');
    if(btn){ btn.disabled=true; btn.textContent='Creating Account…'; }
    await new Promise(r => setTimeout(r, 800));

    const newUser = {
      id: Date.now().toString(), name,
      email: email.toLowerCase(), phone, password: pwd,
      registeredAt: new Date().toISOString(), orders: []
    };
    const users = getUsers();
    users.push(newUser);
    saveUsers(users);
    saveSession(newUser);
    syncToSheet({ sheet: 'Users', name, email, phone, registeredAt: newUser.registeredAt });

    if(btn){ btn.disabled=false; btn.textContent='Create Account'; }

    closeModal();
    renderNavAuth();

    // Redirect to order page if came from one
    const redirect = sessionStorage.getItem('ex_redirect');
    if (redirect) { sessionStorage.removeItem('ex_redirect'); window.location.href = redirect; }
  }

  // ── Auto-init on DOM ready ───────────────────────────────────
  function init() {
    injectModal();
    renderNavAuth();

    // Close modals on overlay click
    document.addEventListener('click', function(e) {
      if (e.target && e.target.id === 'exGateOverlay') closeModal();
      if (e.target && e.target.id === 'exAuthOverlay') closeModal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Public API ───────────────────────────────────────────────
  return {
    isLoggedIn,
    getUser,
    addOrder,
    logout,
    openModal,
    showGate,
    closeModal,
    switchTab,
    goToDashboard,
    renderNavAuth,
    // internal (called from injected HTML)
    _doLogin,
    _doRegister,
    _gateLogin,
    _gateRegister
  };

})();
