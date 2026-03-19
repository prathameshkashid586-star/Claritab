// =============================================
//  Claritab – popup.js  v4.0
//  All Tabs | Smart Groups | Focus | Sessions | Health | Onboarding
// =============================================

// --- DOM ---
const mainApp       = document.getElementById('mainApp');
const onboarding    = document.getElementById('onboarding');
const tabList       = document.getElementById('tabList');
const searchInput   = document.getElementById('searchInput');
const clearSearch   = document.getElementById('clearSearch');
const tabCount      = document.getElementById('tabCount');
const emptyState    = document.getElementById('emptyState');
const filteredCount = document.getElementById('filteredCount');
const settingsBtn   = document.getElementById('settingsBtn');
const apiPanel      = document.getElementById('apiPanel');
const apiKeyInput   = document.getElementById('apiKeyInput');
const saveApiKey    = document.getElementById('saveApiKey');
const apiStatus     = document.getElementById('apiStatus');
const searchWrap    = document.getElementById('searchWrap');
const btnAll        = document.getElementById('btnAll');
const btnGroups     = document.getElementById('btnGroups');
const btnFocus      = document.getElementById('btnFocus');
const btnSessions   = document.getElementById('btnSessions');
const btnHealth     = document.getElementById('btnHealth');
const btnAutoGroup  = document.getElementById('btnAutoGroup');
const btnClearGroups= document.getElementById('btnClearGroups');
const groupsContainer=document.getElementById('groupsContainer');
const groupsEmpty   = document.getElementById('groupsEmpty');
const focusList     = document.getElementById('focusList');
const focusCount    = document.getElementById('focusCount');
const btnActivateFocus=document.getElementById('btnActivateFocus');
const btnExitFocus  = document.getElementById('btnExitFocus');
const focusHeader   = document.getElementById('focusHeader');
const focusActiveBar= document.getElementById('focusActiveBar');
const focusFooter   = document.getElementById('focusFooter');

// --- State ---
let allTabs = [];

// =============================================
//  PROVIDER CONFIG
// =============================================
const PROVIDERS = {
  claude: {
    name: 'Claude',
    icon: '⬡',
    desc: 'Best quality AI. $5 free credits to start.',
    link: 'https://console.anthropic.com',
    linkText: 'console.anthropic.com',
    placeholder: 'sk-ant-...',
    badge: 'paid',
    validate: k => k.startsWith('sk-ant-')
  },
  gemini: {
    name: 'Gemini',
    icon: '✦',
    desc: 'Free forever. No credit card needed. Best for Indian students.',
    link: 'https://aistudio.google.com',
    linkText: 'aistudio.google.com',
    placeholder: 'AIzaSy...',
    badge: 'free',
    validate: k => k.startsWith('AIza')
  },
  openai: {
    name: 'GPT-4o',
    icon: '◎',
    desc: 'Most popular AI. $5 free credits for new accounts.',
    link: 'https://platform.openai.com',
    linkText: 'platform.openai.com',
    placeholder: 'sk-...',
    badge: 'paid',
    validate: k => k.startsWith('sk-')
  },
  groq: {
    name: 'Groq',
    icon: '◈',
    desc: 'Fastest responses. Very generous free tier.',
    link: 'https://console.groq.com',
    linkText: 'console.groq.com',
    placeholder: 'gsk_...',
    badge: 'free',
    validate: k => k.startsWith('gsk_')
  }
};

let selectedProvider = 'claude';
let obSelectedProvider = 'claude';
let savedGroups = [];
let focusSelectedIds = new Set();
let focusModeActive = false;
let hiddenTabIds = [];
let savedSessions = [];
const GROUP_COLORS = ['#5b8fff','#a78bfa','#4ade80','#f59e0b','#f472b6','#22d3ee','#fb923c','#a3e635'];
const SESSION_COLORS = ['#5b8fff','#a78bfa','#4ade80','#f59e0b','#f472b6','#22d3ee'];

// =============================================
//  BOOT
// =============================================
// Load API key + onboarding from local (sensitive/personal)
chrome.storage.local.get(['onboardingDone','apiKey','selectedProvider','focusModeActive','hiddenTabIds','hiddenWindowId'], function(r) {
  if (r.selectedProvider) { selectedProvider = r.selectedProvider; obSelectedProvider = r.selectedProvider; }
  if (r.apiKey) { apiKeyInput.value = r.apiKey; apiStatus.textContent='✓ API key saved'; apiStatus.className='api-status success'; }
  // Init provider UI after loading
  setTimeout(() => { initProviderUI(); initObProviderUI(); }, 100);
  if (r.focusModeActive){ focusModeActive=true; hiddenTabIds=r.hiddenTabIds||[]; }
  if (!r.onboardingDone) {
    onboarding.style.display = 'flex';
    mainApp.style.display    = 'none';
  } else {
    onboarding.style.display = 'none';
    mainApp.style.display    = 'flex';
  }
});

// Load sessions + groups from sync (synced across devices), fall back to local
chrome.storage.sync.get(['savedGroups','savedSessions'], function(syncResult) {
  if (chrome.runtime.lastError || (!syncResult.savedGroups && !syncResult.savedSessions)) {
    chrome.storage.local.get(['savedGroups','savedSessions'], function(localResult) {
      if (localResult.savedGroups)  savedGroups  = localResult.savedGroups;
      if (localResult.savedSessions) savedSessions = localResult.savedSessions;
    });
  } else {
    if (syncResult.savedGroups)  savedGroups  = syncResult.savedGroups;
    if (syncResult.savedSessions) savedSessions = syncResult.savedSessions;
  }
});

chrome.tabs.query({}, function(tabs) {
  allTabs = tabs;
  updateTabCountBadge(tabs.length);
  renderTabs(tabs);
});

// =============================================
//  CENTRAL SYNC SYSTEM
//  All tab changes sync across every feature
// =============================================

// Helper — get current active view
function getActiveView() {
  const views = ['viewAll','viewGroups','viewFocus','viewSessions','viewHealth'];
  for (const v of views) {
    const el = document.getElementById(v);
    if (el && el.style.display !== 'none') return v;
  }
  return 'viewAll';
}

// Helper — re-render current view after any change
function syncCurrentView() {
  const view = getActiveView();
  if (view === 'viewAll')     renderTabs(allTabs);
  if (view === 'viewGroups')  renderGroups();
  if (view === 'viewFocus')   renderFocusView();
  if (view === 'viewHealth')  renderHealth();
}

// Tab removed — sync ALL features
chrome.tabs.onRemoved.addListener(function(tabId) {
  allTabs = allTabs.filter(t => t.id !== tabId);
  updateTabCountBadge(allTabs.length);

  // Sync groups — remove tab from any group it belongs to
  let groupsChanged = false;
  savedGroups = savedGroups.map(g => {
    const before = g.tabs.length;
    g.tabs = g.tabs.filter(t => t.id !== tabId);
    if (g.tabs.length !== before) groupsChanged = true;
    return g;
  }).filter(g => g.tabs && g.tabs.length > 0);
  if (groupsChanged) saveToStorage({ savedGroups });

  // Re-render current view — handles all views including focus
  syncCurrentView();
});

// Tab created — sync ALL features + AI auto-group
chrome.tabs.onCreated.addListener(function(tab) {
  allTabs.push(tab);
  updateTabCountBadge(allTabs.length);
  // Only re-render the tabs view immediately — groups view is synced
  // after the tab fully loads via onUpdated (tab has no title/url yet)
  if (getActiveView() === 'viewAll') renderTabs(allTabs);

  // AI auto-assign to existing group if groups exist
  if (savedGroups.length > 0) {
    // Wait for tab to load fully before assigning
    const checkReady = setInterval(function() {
      chrome.tabs.get(tab.id, function(updatedTab) {
        if (chrome.runtime.lastError) {
          clearInterval(checkReady);
          return;
        }
        // Wait until tab has a real title and URL
        if (updatedTab.status === 'complete' && updatedTab.title && updatedTab.url &&
            !updatedTab.url.startsWith('chrome://') &&
            updatedTab.url !== 'about:newtab' &&
            updatedTab.title !== 'New Tab') {
          clearInterval(checkReady);
          autoAssignTabToGroup(updatedTab);
        }
      });
    }, 1000);

    // Stop checking after 15 seconds
    setTimeout(() => clearInterval(checkReady), 15000);
  }
});

// AI auto-assign a new tab to the best matching group
async function autoAssignTabToGroup(tab) {
  try {
    const result = await new Promise(r => chrome.storage.local.get(['apiKey', 'selectedProvider'], r));
    if (!result.apiKey) return; // No API key — skip silently

    const groupNames = savedGroups.map((g, i) => i + ': ' + g.name + ' (' + g.tabs.slice(0,3).map(t => t.title || cleanUrl(t.url||'')).join(', ') + ')').join('\n');

    const prompt = 'Given these tab groups:\n' + groupNames + '\n\nWhich group best fits this new tab? Title: ' + (tab.title || 'Untitled') + ' URL: ' + (tab.url || '') + '\n\nRespond with ONLY the group index number (0, 1, 2...) or the word none if no match. Single word only.';;

    const data = await callAPI(result.apiKey, prompt, 50);
    const response = (data.content?.[0]?.text || '').trim().toLowerCase();

    // Parse response — expect a number or "none"
    // Extract first number found in response to handle extra text from AI
    if (response === 'none' || response === '') return;
    const numMatch = response.match(/\d+/);
    if (!numMatch) return;
    const groupIdx = parseInt(numMatch[0]);
    if (isNaN(groupIdx) || groupIdx < 0 || groupIdx >= savedGroups.length) return;

    // Add tab to the matched group
    const tabData = {
      id: tab.id,
      title: tab.title || 'Untitled',
      url: tab.url || '',
      favIconUrl: tab.favIconUrl || ''
    };

    // Don't add if already in this group
    const alreadyIn = savedGroups[groupIdx].tabs.some(t => t.url === tab.url);
    if (alreadyIn) return;

    savedGroups[groupIdx].tabs.push(tabData);
    saveToStorage({ savedGroups });

    // Re-render groups if currently visible
    if (getActiveView() === 'viewGroups') renderGroups();

    // Show subtle toast notification
    showToast('✦ Added to "' + savedGroups[groupIdx].name + '"');
    console.log('[Claritab] Auto-assigned "' + tab.title + '" to group "' + savedGroups[groupIdx].name + '"');

  } catch(e) {
    // Fail silently — this is a background operation
    console.log('[Claritab] Auto-assign failed:', e.message);
  }
}

// Show a subtle toast message
function showToast(message) {
  const existing = document.getElementById('claritab-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'claritab-toast';
  toast.className = 'claritab-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add('visible'), 10);
  // Animate out
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Tab updated (URL change, title change) — sync ALL features  
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' || changeInfo.title) {
    // Update tab in allTabs
    const idx = allTabs.findIndex(t => t.id === tabId);
    if (idx !== -1) {
      allTabs[idx] = { ...allTabs[idx], ...tab };
    }
    // Update tab in groups
    let groupsChanged = false;
    savedGroups = savedGroups.map(g => {
      g.tabs = g.tabs.map(t => {
        if (t.id === tabId) {
          groupsChanged = true;
          return { ...t, title: tab.title || t.title, url: tab.url || t.url, favIconUrl: tab.favIconUrl || t.favIconUrl };
        }
        return t;
      });
      return g;
    });
    if (groupsChanged) saveToStorage({ savedGroups });
    syncCurrentView();
  }
});

// Tab moved/activated — refresh active tab highlight
chrome.tabs.onActivated.addListener(function(activeInfo) {
  allTabs = allTabs.map(t => ({
    ...t,
    active: t.id === activeInfo.tabId
  }));
  if (getActiveView() === 'viewAll') renderTabs(allTabs);
});

// =============================================
//  ONBOARDING
// =============================================
let obCurrentStep = 0;

function obNext() {
  const cur = document.getElementById('obStep' + obCurrentStep);
  if (cur) cur.style.display = 'none';
  document.getElementById('obDot' + obCurrentStep).classList.remove('active');
  document.getElementById('obDot' + obCurrentStep).classList.add('done');
  obCurrentStep++;
  const next = document.getElementById('obStep' + obCurrentStep);
  if (next) { next.style.display = 'flex'; next.style.flexDirection = 'column'; next.style.alignItems = 'center'; }
  const nextDot = document.getElementById('obDot' + obCurrentStep);
  if (nextDot) nextDot.classList.add('active');
};

function finishOnboarding() {
  chrome.storage.local.set({ onboardingDone: true });
  onboarding.style.display = 'none';
  mainApp.style.display = 'flex';
};

document.getElementById('obSkip').addEventListener('click', finishOnboarding);
document.getElementById('obStep0Btn').addEventListener('click', obNext);
document.getElementById('obSkipKey').addEventListener('click', obNext);
document.getElementById('obFinishBtn').addEventListener('click', finishOnboarding);

// obSaveKey handled by provider UI section below

// =============================================
//  NAVIGATION
// =============================================
btnAll.addEventListener('click',     () => switchView('all'));
btnGroups.addEventListener('click',  () => switchView('groups'));
btnFocus.addEventListener('click',   () => switchView('focus'));
btnSessions.addEventListener('click',() => switchView('sessions'));
btnHealth.addEventListener('click',  () => switchView('health'));

function switchView(view) {
  [btnAll,btnGroups,btnFocus,btnSessions,btnHealth].forEach(b=>b.classList.remove('active'));
  const map = {all:btnAll,groups:btnGroups,focus:btnFocus,sessions:btnSessions,health:btnHealth};
  map[view].classList.add('active');
  searchWrap.style.display = view==='all' ? '' : 'none';
  document.getElementById('viewAll').style.display      = view==='all'      ? '' : 'none';
  document.getElementById('viewGroups').style.display   = view==='groups'   ? '' : 'none';
  document.getElementById('viewFocus').style.display    = view==='focus'    ? '' : 'none';
  document.getElementById('viewSessions').style.display = view==='sessions' ? '' : 'none';
  document.getElementById('viewHealth').style.display   = view==='health'   ? '' : 'none';
  if (view==='groups')   renderGroups();
  if (view==='focus')    renderFocusView();
  if (view==='sessions') renderSessions();
  if (view==='health')   renderHealth();
  updateShortcutHint(view);
}

// =============================================
//  SETTINGS
// =============================================
settingsBtn.addEventListener('click', () => {
  apiPanel.style.display = apiPanel.style.display!=='none' ? 'none' : 'flex';
});
saveApiKey.addEventListener('click', function() {
  const key = apiKeyInput.value.trim();
  const provider = PROVIDERS[selectedProvider];
  if (!provider.validate(key)) {
    apiStatus.textContent = '✗ Invalid key for ' + provider.name + '. Should start with ' + provider.placeholder;
    apiStatus.className = 'api-status error';
    return;
  }
  chrome.storage.local.set({apiKey: key, selectedProvider}, () => {
    apiStatus.textContent = '✓ ' + provider.name + ' key saved!';
    apiStatus.className = 'api-status success';
    setTimeout(() => { apiPanel.style.display='none'; }, 1000);
  });
  // API key stays in local only — never sync for security
});

// =============================================
//  ALL TABS
// =============================================
function renderTabs(tabs, query='') {
  tabList.innerHTML='';
  if (tabs.length===0) { emptyState.style.display='flex'; filteredCount.textContent=''; return; }
  emptyState.style.display='none';
  filteredCount.textContent = query ? `${tabs.length} of ${allTabs.length} match` : '';
  tabs.forEach((tab,i) => tabList.appendChild(createTabCard(tab,query,i)));
}

function createTabCard(tab, query, index) {
  const card = document.createElement('div');
  card.className = 'tab-card'+(tab.active?' active-tab':'');
  card.style.animationDelay = (index*25)+'ms';
  const favicon = createFavicon(tab);
  const info = document.createElement('div'); info.className='tab-info';
  const title = document.createElement('div'); title.className='tab-title'; title.innerHTML=highlight(tab.title||'Untitled',query); title.title=tab.title||'';
  const url   = document.createElement('div'); url.className='tab-url';   url.innerHTML=highlight(cleanUrl(tab.url||''),query);
  info.appendChild(title); info.appendChild(url);
  const sumBtn = document.createElement('button'); sumBtn.className='tab-summarize-btn'; sumBtn.innerHTML='✦'; sumBtn.title='AI Summary';
  const sumWrapper = document.createElement('div'); sumWrapper.className='tab-summary-wrapper';
  const sumBox = document.createElement('div'); sumBox.className='tab-summary'; sumBox.innerHTML='<div class="tab-summary-label">AI Summary</div><span class="summary-text"></span>';
  sumWrapper.appendChild(sumBox);
  sumBtn.addEventListener('click',e=>{e.stopPropagation();handleSummarize(tab,sumBtn,sumBox,card);});
  const closeBtn = document.createElement('button'); closeBtn.className='tab-close'; closeBtn.innerHTML='✕';
  closeBtn.addEventListener('click',e=>{e.stopPropagation();closeTab(tab.id,card);});
  card.addEventListener('click',()=>switchToTab(tab.id,tab.windowId));
  card.appendChild(favicon); card.appendChild(info); card.appendChild(sumBtn); card.appendChild(closeBtn); card.appendChild(sumWrapper);
  return card;
}

// =============================================
//  SMART GROUPS
// =============================================
// Show move-to-group dropdown menu
function showMoveMenu(anchorBtn, tab, fromGroupIdx) {
  // Remove any existing menu
  const existing = document.getElementById('moveMenu');
  if (existing) existing.remove();

  const otherGroups = savedGroups
    .map((g, i) => ({ ...g, index: i }))
    .filter(g => g.index !== fromGroupIdx);

  if (otherGroups.length === 0) {
    // No other groups — offer to create new group
    const menu = document.createElement('div');
    menu.id = 'moveMenu';
    menu.className = 'move-menu';
    menu.innerHTML = '<div class="move-menu-item muted">No other groups exist</div>';
    document.body.appendChild(menu);
    positionMenu(menu, anchorBtn);
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 10);
    return;
  }

  const menu = document.createElement('div');
  menu.id = 'moveMenu';
  menu.className = 'move-menu';

  const label = document.createElement('div');
  label.className = 'move-menu-label';
  label.textContent = 'Move to:';
  menu.appendChild(label);

  otherGroups.forEach(g => {
    const item = document.createElement('div');
    item.className = 'move-menu-item';
    const dot = document.createElement('span');
    dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${g.color};margin-right:7px;flex-shrink:0;`;
    item.appendChild(dot);
    item.appendChild(document.createTextNode(g.name));
    item.addEventListener('click', e => {
      e.stopPropagation();
      // Remove from current group
      savedGroups[fromGroupIdx].tabs = savedGroups[fromGroupIdx].tabs.filter(x => x.id !== tab.id);
      // Add to target group
      savedGroups[g.index].tabs.push(tab);
      saveToStorage({ savedGroups });
      menu.remove();
      renderGroups();
    });
    menu.appendChild(item);
  });

  document.body.appendChild(menu);
  positionMenu(menu, anchorBtn);
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 10);
}

function positionMenu(menu, anchor) {
  const rect   = anchor.getBoundingClientRect();
  const menuH  = 200; // max-height
  const menuW  = 170;
  const winH   = window.innerHeight;
  const winW   = window.innerWidth;

  // Flip above if not enough space below
  let top = rect.bottom + 4;
  if (top + menuH > winH - 10) {
    top = Math.max(10, rect.top - menuH - 4);
  }

  // Keep within horizontal bounds
  let left = rect.left;
  if (left + menuW > winW - 10) {
    left = winW - menuW - 10;
  }
  if (left < 8) left = 8;

  menu.style.top  = top  + 'px';
  menu.style.left = left + 'px';
}

function renderGroups() {
  // Always reload from storage first — catches any auto-assigns
  // that happened while the popup was closed
  chrome.storage.sync.get(['savedGroups'], function(syncResult) {
    if (!chrome.runtime.lastError && syncResult.savedGroups) {
      savedGroups = syncResult.savedGroups;
    }
    _renderGroupsUI();
  });
}

function _renderGroupsUI() {
  groupsContainer.innerHTML='';
  if (savedGroups.length===0) { groupsEmpty.style.display='flex'; return; }
  groupsEmpty.style.display='none';
  savedGroups.forEach((group,gi) => {
    const card = document.createElement('div'); card.className='group-card';
    const header = document.createElement('div'); header.className='group-header';
    const dot = document.createElement('div'); dot.className='group-dot'; dot.style.background=group.color||GROUP_COLORS[gi%GROUP_COLORS.length];
    const nameInput = document.createElement('input'); nameInput.className='group-name-input'; nameInput.value=group.name;
    nameInput.addEventListener('click',e=>e.stopPropagation());
    nameInput.addEventListener('change',()=>{savedGroups[gi].name=nameInput.value;saveToStorage({ savedGroups });});
    const count = document.createElement('span'); count.className='group-count'; count.textContent=`${group.tabs.length} tab${group.tabs.length!==1?'s':''}`;
    const chevron = document.createElement('span'); chevron.className='group-chevron'; chevron.textContent='▶';

    // Edit mode button
    const editBtn = document.createElement('button');
    editBtn.className='group-edit-btn'; editBtn.textContent='Edit'; editBtn.title='Edit group tabs';
    editBtn.addEventListener('click', e => {
      e.stopPropagation();
      const isEditing = tabsDiv.classList.toggle('edit-mode');
      editBtn.textContent = isEditing ? 'Done' : 'Edit';
      editBtn.style.color = isEditing ? 'var(--success)' : '';
    });

    const tabsDiv = document.createElement('div'); tabsDiv.className='group-tabs';
    header.addEventListener('click', e => {
      if (e.target === editBtn) return;
      tabsDiv.classList.toggle('open');
      chevron.classList.toggle('open');
    });

    group.tabs.forEach(t=>{
      const item=document.createElement('div'); item.className='group-tab-item';
      const fav=createFaviconSmall(t);
      const titleEl=document.createElement('span'); titleEl.className='group-tab-title'; titleEl.textContent=t.title||'Untitled';

      // Move to another group dropdown
      const moveBtn = document.createElement('button');
      moveBtn.className='group-tab-move'; moveBtn.innerHTML='⇄'; moveBtn.title='Move to another group';
      moveBtn.addEventListener('click', e => {
        e.stopPropagation();
        showMoveMenu(moveBtn, t, gi);
      });

      const closeEl=document.createElement('button'); closeEl.className='group-tab-close'; closeEl.innerHTML='✕';
      closeEl.title='Remove from group';
      closeEl.addEventListener('click',e=>{
        e.stopPropagation();
        savedGroups[gi].tabs=savedGroups[gi].tabs.filter(x=>x.id!==t.id);
        saveToStorage({ savedGroups });
        renderGroups();
      });

      item.addEventListener('click', () => {
        if (!tabsDiv.classList.contains('edit-mode')) switchToTab(t.id,t.windowId);
      });
      item.appendChild(fav);item.appendChild(titleEl);item.appendChild(moveBtn);item.appendChild(closeEl);tabsDiv.appendChild(item);
    });
    tabsDiv.classList.add('open'); chevron.classList.add('open');
    // Divider before compare button
    const compareDivider = document.createElement('div');
    compareDivider.style.cssText = 'height:1px;background:var(--border);margin:0 0 2px;';

    const compareBtn = document.createElement('button'); compareBtn.className='group-compare-btn';
    compareBtn.innerHTML='⚖ Compare for Research'; compareBtn.disabled=group.tabs.length<2;
    compareBtn.title = group.tabs.length < 2 ? 'Need at least 2 tabs to compare' : 'AI compares tabs for research quality';
    const comparePanel = document.createElement('div'); comparePanel.className='compare-panel';
    compareBtn.addEventListener('click',async e=>{
      e.stopPropagation();
      if (comparePanel.classList.contains('open')) { comparePanel.classList.remove('open'); compareBtn.innerHTML='⚖ Compare for Research'; return; }
      await runCompare(group,gi,compareBtn,comparePanel);
    });
    header.appendChild(dot);header.appendChild(nameInput);header.appendChild(count);header.appendChild(editBtn);header.appendChild(chevron);
    card.appendChild(header);card.appendChild(tabsDiv);card.appendChild(compareDivider);card.appendChild(compareBtn);card.appendChild(comparePanel);
    groupsContainer.appendChild(card);
  });
}

btnAutoGroup.addEventListener('click', async function() {
  const r = await new Promise(res=>chrome.storage.local.get(['apiKey'],res));
  if (!r.apiKey) { apiPanel.style.display='flex'; apiStatus.textContent='⚠ Please save your API key first'; apiStatus.className='api-status error'; return; }
  groupsContainer.innerHTML=`<div class="groups-loading"><div class="groups-loading-spinner"></div><span>AI is grouping your tabs...</span></div>`;
  groupsEmpty.style.display='none'; btnAutoGroup.disabled=true; btnAutoGroup.textContent='Grouping...';
  try {
    const newGroups = await autoGroupWithAI(r.apiKey, allTabs);
    // Replace all groups — don't append to existing ones
    savedGroups = newGroups;
    saveToStorage({ savedGroups });
    renderGroups();
  }
  catch(err) { groupsContainer.innerHTML=''; groupsEmpty.style.display='flex'; groupsEmpty.querySelector('p').textContent='✗ '+err.message; }
  finally { btnAutoGroup.disabled=false; btnAutoGroup.textContent='✦ AI Auto-Group'; }
});

btnClearGroups.addEventListener('click',()=>{ savedGroups=[]; saveToStorage({ savedGroups }); renderGroups(); });

// =============================================
//  MANUAL GROUPING
// =============================================
let manualSelectedIds = new Set();
let manualSelectedTabs = [];

document.getElementById('btnManualGroup').addEventListener('click', () => {
  const panel = document.getElementById('manualPanel');
  const nameDialog = document.getElementById('nameDialog');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  nameDialog.style.display = 'none';
  if (!isOpen) renderManualTabList();
});

function renderManualTabList() {
  const list = document.getElementById('manualTabList');
  list.innerHTML = '';
  manualSelectedIds.clear();
  updateManualCount();

  allTabs.forEach(tab => {
    const row = document.createElement('div');
    row.className = 'manual-tab-row';

    const checkbox = document.createElement('div');
    checkbox.className = 'manual-checkbox';
    const tick = document.createElement('span');
    tick.className = 'manual-checkbox-tick';
    tick.textContent = '✓';
    checkbox.appendChild(tick);

    const favicon = createFaviconSmall(tab);

    const info = document.createElement('div');
    info.style.flex = '1';
    info.style.minWidth = '0';
    const title = document.createElement('div');
    title.className = 'manual-tab-title';
    title.textContent = tab.title || 'Untitled';
    const url = document.createElement('div');
    url.className = 'manual-tab-url';
    url.textContent = cleanUrl(tab.url || '');
    info.appendChild(title);
    info.appendChild(url);

    row.appendChild(checkbox);
    row.appendChild(favicon);
    row.appendChild(info);

    row.addEventListener('click', () => {
      const sel = row.classList.toggle('selected');
      sel ? manualSelectedIds.add(tab.id) : manualSelectedIds.delete(tab.id);
      updateManualCount();
    });

    list.appendChild(row);
  });
}

function updateManualCount() {
  const n = manualSelectedIds.size;
  document.getElementById('manualCount').textContent = `${n} selected`;
  document.getElementById('btnManualCreate').disabled = n < 2;
}

document.getElementById('btnManualCreate').addEventListener('click', () => {
  if (manualSelectedIds.size < 2) return;
  manualSelectedTabs = allTabs.filter(t => manualSelectedIds.has(t.id));
  document.getElementById('manualPanel').style.display = 'none';
  const nameDialog = document.getElementById('nameDialog');
  nameDialog.style.display = 'flex';
  nameDialog.style.flexDirection = 'column';
  document.getElementById('groupNameInput').value = '';
  document.getElementById('nameStatus').textContent = '';
  document.getElementById('groupNameInput').focus();
});

document.getElementById('btnManualCancel').addEventListener('click', () => {
  document.getElementById('manualPanel').style.display = 'none';
  manualSelectedIds.clear();
});

document.getElementById('btnCancelName').addEventListener('click', () => {
  document.getElementById('nameDialog').style.display = 'none';
  manualSelectedIds.clear();
});

document.getElementById('btnConfirmGroup').addEventListener('click', () => {
  const name = document.getElementById('groupNameInput').value.trim();
  if (!name) {
    document.getElementById('nameStatus').textContent = '⚠ Please enter a name';
    document.getElementById('nameStatus').className = 'api-status error';
    return;
  }
  createManualGroup(name);
});

document.getElementById('btnAiName').addEventListener('click', async () => {
  const r = await new Promise(res => chrome.storage.local.get(['apiKey'], res));
  if (!r.apiKey) {
    document.getElementById('nameStatus').textContent = '⚠ API key needed for AI naming';
    document.getElementById('nameStatus').className = 'api-status error';
    return;
  }
  const btn = document.getElementById('btnAiName');
  btn.textContent = '✦ Thinking...';
  btn.disabled = true;
  document.getElementById('nameStatus').textContent = '';
  try {
    const tabTitles = manualSelectedTabs.map(t => t.title || cleanUrl(t.url || '')).join(', ');
    const data = await callAPI(r.apiKey, 'Suggest a short 1-3 word name for a browser tab group containing: ' + tabTitles + '. Reply with ONLY the name. No quotes, no punctuation, no explanation. Just the name.', 100);
    const raw = data.content?.[0]?.text || '';
    const suggested = raw.replace(/['"`.]/g, '').replace(/```/g, '').split('\n')[0].trim().slice(0, 30);
    if (suggested) document.getElementById('groupNameInput').value = suggested;
  } catch(err) {
    document.getElementById('nameStatus').textContent = '✗ ' + (err.message || 'Could not suggest name');
    document.getElementById('nameStatus').className = 'api-status error';
  } finally {
    btn.textContent = '✦ AI Suggest Name';
    btn.disabled = false;
  }
});

function createManualGroup(name) {
  const newGroup = {
    name,
    color: GROUP_COLORS[savedGroups.length % GROUP_COLORS.length],
    tabs: manualSelectedTabs
  };
  savedGroups.push(newGroup);
  saveToStorage({ savedGroups });
  document.getElementById('nameDialog').style.display = 'none';
  manualSelectedIds.clear();
  manualSelectedTabs = [];
  renderGroups();
}

// =============================================
//  CLEAN JSON — strips markdown from any AI provider
// =============================================
function cleanJSON(text) {
  if (!text) return '{}';

  // Step 1: Remove markdown code fences
  text = text.replace(/```json/gi, '').replace(/```/g, '');

  // Step 2: Remove any text before first { and after last }
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  // Step 3: Fix common Gemini JSON issues
  text = text
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
    .replace(/:\s*'([^']*)'/g, ': "$1"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .trim();

  return text;
}

// Try to parse JSON with multiple fallback strategies
function safeParseJSON(text) {
  // Attempt 1: direct parse
  try { return JSON.parse(text); } catch(e1) {}

  // Attempt 2: clean then parse
  try { return JSON.parse(cleanJSON(text)); } catch(e2) {}

  // Attempt 3: extract first complete JSON object
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch(e3) {}

  // Attempt 4: fix and parse
  try {
    let fixed = text
      .replace(/```json/gi, '').replace(/```/g, '')
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/\n/g, ' ').replace(/\r/g, '').trim();
    const m = fixed.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch(e4) {}

  throw new Error('Could not parse AI response after multiple attempts.');
}

async function autoGroupWithAI(apiKey, tabs) {
  const tabInfo = tabs.map((t,i) => `${i}: ${t.title||'Untitled'} | ${cleanUrl(t.url||'')}`).join('\n');
  const prompt = 'You are a tab organizer. Group these browser tabs into 2-6 logical categories.\n\nTabs:\n' + tabInfo + '\n\nCRITICAL: Your entire response must be ONLY the JSON object below. No intro text, no explanation, no markdown, no backticks.\n{"groups":[{"name":"Group Name","tabIndexes":[0,2,5]},{"name":"Another Group","tabIndexes":[1,3]}]}\nRules: every tab index must appear exactly once, group names 1-3 words, unknowns go in Other.';

  const data = await callAPI(apiKey, prompt, 1000);
  let text = data.content?.[0]?.text?.trim() || '';

  // Universal cleanup — handles all provider formats
  text = cleanJSON(text);

  let parsed;
  try { parsed = safeParseJSON(text); }
  catch(e) { throw new Error('Could not parse AI response. Please try again.'); }

  if (!parsed.groups || !Array.isArray(parsed.groups)) {
    throw new Error('AI returned unexpected format. Please try again.');
  }

  return parsed.groups
    .map((g, i) => ({
      name: g.name || 'Group ' + (i+1),
      color: GROUP_COLORS[i % GROUP_COLORS.length],
      tabs: (g.tabIndexes || []).map(idx => tabs[idx]).filter(Boolean)
    }))
    .filter(g => g.tabs.length > 0);
}

// =============================================
//  COMPARE
// =============================================
async function runCompare(group, gi, compareBtn, comparePanel) {
  const r = await new Promise(res=>chrome.storage.local.get(['apiKey'],res));
  if (!r.apiKey) { apiPanel.style.display='flex'; apiStatus.textContent='⚠ Please save your API key first'; apiStatus.className='api-status error'; return; }
  comparePanel.classList.add('open');
  comparePanel.innerHTML=`<div class="compare-loading"><div class="compare-loading-spinner"></div><span>Analysing ${group.tabs.length} websites...</span></div>`;
  compareBtn.innerHTML='⚖ Analysing...'; compareBtn.disabled=true;
  try {
    const tabsData = await Promise.all(group.tabs.map(async tab=>{
      let pageText='';
      try { if (tab.url&&!tab.url.startsWith('chrome://')) { const res=await chrome.scripting.executeScript({target:{tabId:tab.id},func:extractPageText}); pageText=res[0]?.result||''; } } catch{}
      return {title:tab.title||'Untitled',url:tab.url||'',text:pageText.slice(0,1500)};
    }));
    const scores = await compareWithAI(r.apiKey, tabsData);
    renderCompareResults(comparePanel, scores, group.tabs);
    compareBtn.innerHTML='⚖ Hide Results';
  } catch(err) {
    comparePanel.innerHTML=`<div class="compare-loading"><span>✗ ${err.message||'Could not compare'}</span></div>`;
    compareBtn.innerHTML='⚖ Compare for Research';
  } finally { compareBtn.disabled=false; }
}

async function compareWithAI(apiKey, tabsData) {
  const tabsInfo = tabsData.map((t,i)=>`TAB ${i+1}:\nTitle: ${t.title}\nURL: ${t.url}\nContent: ${t.text||'(none)'}`).join('\n\n---\n\n');
  // Build minimal tab info to save tokens
  const minimalInfo = tabsData.map((t,i) =>
    'TAB ' + (i+1) + ': ' + t.title + ' | ' + t.url
  ).join('\n');

  const prompt = 'Score these tabs for research quality. Raw JSON only, no markdown.' +
    '\nFormat: {"results":[{"tabIndex":0,"credibility":80,"depth":70,"bias":85,"overallScore":78,"verdict":"5 words max"}],"winnerIndex":0,"winnerReason":"5 words max"}' +
    '\ncredibility=trust, depth=detail, bias=neutrality(100=neutral), overall=average.' +
    '\nKeep verdict under 5 words. Keep winnerReason under 5 words.' +
    '\n\n' + minimalInfo;
  const data = await callAPI(apiKey, prompt, 1000);
  let text = data.content?.[0]?.text?.trim() || '{}';

  // Use bulletproof safeParseJSON — handles all providers
  try { return safeParseJSON(text); }
  catch(e) { throw new Error('AI returned invalid JSON for comparison. Please try again.'); }
}

function renderCompareResults(panel, scores, tabs) {
  panel.innerHTML='';
  const header=document.createElement('div'); header.className='compare-panel-header';
  header.innerHTML=`<div class="compare-panel-title">⚖ Research Comparison</div><button class="compare-panel-close" id="closePanelBtn">✕</button>`;
  panel.appendChild(header);
  const winnerTab=tabs[scores.winnerIndex];
  const banner=document.createElement('div'); banner.className='compare-winner-banner';
  banner.innerHTML=`<span style="font-size:16px">🏆</span><span class="compare-winner-text"><strong>Best:</strong> ${escapeHtml(winnerTab?.title||'Unknown')} — ${escapeHtml(scores.winnerReason||'')}</span>`;
  panel.appendChild(banner);
  const list=document.createElement('div'); list.className='compare-results-list';
  const sorted=[...scores.results].sort((a,b)=>b.overallScore-a.overallScore);
  sorted.forEach((r,rankIdx)=>{
    const tab=tabs[r.tabIndex]; const isWinner=r.tabIndex===scores.winnerIndex;
    const rankClass=rankIdx===0?'rank-1':rankIdx===1?'rank-2':rankIdx===2?'rank-3':'rank-other';
    const siteCard=document.createElement('div'); siteCard.className='compare-site-card'+(isWinner?' winner':'');
    siteCard.innerHTML=`<div class="compare-site-top"><div class="compare-site-rank ${rankClass}">${rankIdx+1}</div><span class="compare-site-name" title="${escapeHtml(tab?.title||'')}">${escapeHtml(tab?.title||'Untitled')}</span><span class="compare-site-score">${r.overallScore}/100</span></div>
    <div class="compare-score-bars">
      <div class="score-bar-row"><span class="score-bar-label">Credibility</span><div class="score-bar-track"><div class="score-bar-fill bar-credibility" style="width:${r.credibility}%"></div></div><span class="score-bar-val">${r.credibility}</span></div>
      <div class="score-bar-row"><span class="score-bar-label">Depth</span><div class="score-bar-track"><div class="score-bar-fill bar-depth" style="width:${r.depth}%"></div></div><span class="score-bar-val">${r.depth}</span></div>
      <div class="score-bar-row"><span class="score-bar-label">Neutrality</span><div class="score-bar-track"><div class="score-bar-fill bar-bias" style="width:${r.bias}%"></div></div><span class="score-bar-val">${r.bias}</span></div>
    </div>
    <div class="compare-verdict">${escapeHtml(r.verdict||'')}</div>`;
    list.appendChild(siteCard);
  });
  panel.appendChild(list);
  panel.querySelector('#closePanelBtn').addEventListener('click',()=>{panel.classList.remove('open');panel.previousElementSibling.innerHTML='⚖ Compare for Research';});
}

// =============================================
//  FOCUS MODE
// =============================================
function renderFocusView() {
  focusList.innerHTML=''; focusSelectedIds.clear();
  if (focusModeActive) {
    focusHeader.style.display='none';
    focusActiveBar.style.display='flex';
    focusFooter.style.display='none';
    focusList.innerHTML='';

    // Read focused URLs and render with correct isFocused flag
    chrome.storage.local.get(['focusedTabUrls'], function(r) {
      const focusedUrls = new Set(r.focusedTabUrls || []);
      allTabs.forEach((tab,i) => {
        const isFocused = focusedUrls.has(tab.url);
        focusList.appendChild(createFocusTabItem(tab, i, true, isFocused));
      });
    });
    return;
  }
  focusHeader.style.display=''; focusActiveBar.style.display='none'; focusFooter.style.display='flex';
  updateFocusCount();
  allTabs.forEach((tab,i)=>focusList.appendChild(createFocusTabItem(tab,i,false)));
}

function createFocusTabItem(tab, index, readOnly, isFocused) {
  const item = document.createElement('div');
  item.style.animationDelay = (index * 20) + 'ms';

  if (!readOnly) {
    // SELECTION MODE — normal focus-tab-item with checkbox
    item.className = 'focus-tab-item';
  } else if (isFocused) {
    // ACTIVE FOCUS MODE — focused tab (highlighted green)
    item.className = 'focus-tab-item focus-tab-focused';
  } else {
    // ACTIVE FOCUS MODE — non-focused tab (dimmed)
    item.className = 'focus-tab-item focus-tab-dimmed';
  }

  const checkbox = document.createElement('div');
  checkbox.className = 'focus-checkbox';
  const tick = document.createElement('span');
  tick.className = 'focus-checkbox-tick';
  tick.textContent = '✓';
  checkbox.appendChild(tick);

  const favicon = createFavicon(tab);

  const info = document.createElement('div');
  info.className = 'focus-tab-info';
  const t = document.createElement('div');
  t.className = 'focus-tab-title';
  t.textContent = tab.title || 'Untitled';
  const u = document.createElement('div');
  u.className = 'focus-tab-url';
  u.textContent = cleanUrl(tab.url || '');
  info.appendChild(t);
  info.appendChild(u);

  item.appendChild(checkbox);
  item.appendChild(favicon);
  item.appendChild(info);

  if (!readOnly) {
    // Selection mode — checkbox toggle
    item.addEventListener('click', () => {
      const sel = item.classList.toggle('selected');
      sel ? focusSelectedIds.add(tab.id) : focusSelectedIds.delete(tab.id);
      updateFocusCount();
    });
  } else {
    // Active focus mode — hide checkbox, click switches to tab
    checkbox.style.display = 'none';

    // Add FOCUS / OTHER badge
    const badge = document.createElement('span');
    badge.className = isFocused ? 'focus-badge-yes' : 'focus-badge-no';
    badge.textContent = isFocused ? 'FOCUS' : 'OTHER';
    item.appendChild(badge);

    item.addEventListener('click', () => switchToTab(tab.id, tab.windowId));
  }

  return item;
}

function updateFocusCount() {
  const n=focusSelectedIds.size;
  focusCount.textContent=`${n} tab${n!==1?'s':''} selected`;
  btnActivateFocus.disabled=n===0;
}

btnActivateFocus.addEventListener('click', async function() {
  if (focusSelectedIds.size===0) return;
  const toHide=allTabs.filter(t=>!focusSelectedIds.has(t.id)).map(t=>t.id);
  const focusedUrls=allTabs.filter(t=>focusSelectedIds.has(t.id)).map(t=>t.url);
  for (const id of toHide) { try { await chrome.tabs.discard(id); } catch{} }
  hiddenTabIds=toHide; focusModeActive=true;
  chrome.storage.local.set({focusModeActive:true,hiddenTabIds:toHide,focusedTabUrls:focusedUrls});
  renderFocusView();
});

btnExitFocus.addEventListener('click',()=>{ focusModeActive=false; hiddenTabIds=[]; focusSelectedIds.clear(); chrome.storage.local.set({focusModeActive:false,hiddenTabIds:[]}); renderFocusView(); });

// =============================================
//  SESSIONS
// =============================================
function renderSessions() {
  const list = document.getElementById('sessionsList');
  const empty = document.getElementById('sessionsEmpty');
  const saveDialog = document.getElementById('saveDialog');
  list.innerHTML = ''; saveDialog.style.display = 'none';

  // Read from local first (most up to date), then merge with sync
  chrome.storage.local.get(['savedSessions'], function(localResult) {
    const localSessions = localResult.savedSessions || [];
    chrome.storage.sync.get(['savedSessions'], function(syncResult) {
      const syncSessions = syncResult.savedSessions || [];
      // Merge — local takes priority, add any sync sessions not in local
      const localNames = new Set(localSessions.map(s => s.name + s.savedAt));
      const uniqueSync = syncSessions.filter(s => !localNames.has(s.name + s.savedAt));
      savedSessions = [...localSessions, ...uniqueSync];
      _renderSessionsList(list, empty);
    });
  });
}

function _renderSessionsList(list, empty) {
  list.innerHTML = '';
  if (savedSessions.length===0) { empty.style.display='flex'; return; }
  empty.style.display='none';
  savedSessions.forEach((session,si)=>{
    const card=document.createElement('div'); card.className='session-card';
    const header=document.createElement('div'); header.className='session-header';
    // Auto-saved sessions get a special color
    const dotColor = session.autoSaved ? '#f59e0b' : SESSION_COLORS[si%SESSION_COLORS.length];
    const dot=document.createElement('div'); dot.className='session-color'; dot.style.background=dotColor;
    const info=document.createElement('div'); info.className='session-info';
    const nameRow=document.createElement('div'); nameRow.style.cssText='display:flex;align-items:center;gap:6px;';
    const name=document.createElement('div'); name.className='session-name'; name.textContent=session.name;
    if (session.autoSaved) {
      const badge=document.createElement('span');
      badge.style.cssText='font-size:9px;background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3);border-radius:4px;padding:1px 5px;flex-shrink:0;';
      badge.textContent='AUTO';
      nameRow.appendChild(name); nameRow.appendChild(badge);
    } else { nameRow.appendChild(name); }
    const meta=document.createElement('div'); meta.className='session-meta'; meta.textContent=`${session.tabs.length} tabs · ${timeAgo(session.savedAt)}` + (session.autoSaved ? ' · synced' : '');
    info.appendChild(nameRow); info.appendChild(meta);
    const actions=document.createElement('div'); actions.className='session-actions';
    const restoreBtn=document.createElement('button'); restoreBtn.className='btn-restore'; restoreBtn.textContent='Restore';
    restoreBtn.addEventListener('click',()=>restoreSession(session));
    const delBtn=document.createElement('button'); delBtn.className='btn-del'; delBtn.textContent='✕';
    delBtn.addEventListener('click',()=>{
      // Delete by savedAt timestamp — safe even after sync merge reorders array
      const savedAt = session.savedAt;
      savedSessions = savedSessions.filter(s => s.savedAt !== savedAt);
      chrome.storage.sync.set({ savedSessions }, () => {
        chrome.storage.local.set({ savedSessions }, () => {
          renderSessions();
        });
      });
    });
    actions.appendChild(restoreBtn); actions.appendChild(delBtn);
    header.appendChild(dot); header.appendChild(info); header.appendChild(actions);
    // Preview
    const preview=document.createElement('div'); preview.className='session-preview';
    const previewTabs=session.tabs.slice(0,3);
    previewTabs.forEach(t=>{ const row=document.createElement('div'); row.className='preview-row'; const pdot=document.createElement('div'); pdot.className='preview-dot'; const ptitle=document.createElement('span'); ptitle.className='preview-title'; ptitle.textContent=t.title||t.url||'Untitled'; row.appendChild(pdot); row.appendChild(ptitle); preview.appendChild(row); });
    if (session.tabs.length>3) { const more=document.createElement('div'); more.className='preview-more'; more.textContent=`+${session.tabs.length-3} more tabs`; preview.appendChild(more); }
    card.appendChild(header); card.appendChild(preview);
    list.appendChild(card);
  });
}

document.getElementById('btnSaveSession').addEventListener('click',()=>{
  const dialog=document.getElementById('saveDialog');
  dialog.style.display=dialog.style.display==='none'?'flex':'none';
  if (dialog.style.display==='flex') {
    dialog.style.flexDirection='column';
    document.getElementById('sessionNameInput').value='My Session '+new Date().toLocaleDateString();
    document.getElementById('sessionTabCount').textContent=`${allTabs.length} tabs will be saved`;
  }
});

document.getElementById('btnCancelSave').addEventListener('click',()=>{ document.getElementById('saveDialog').style.display='none'; });

document.getElementById('btnConfirmSave').addEventListener('click',()=>{
  const name = document.getElementById('sessionNameInput').value.trim() || 'Untitled Session';
  const session = {
    name,
    savedAt: Date.now(),
    tabs: allTabs.map(t => ({
      id: t.id,
      title: t.title || 'Untitled',
      url: t.url || '',
      favIconUrl: t.favIconUrl || ''
    }))
  };
  savedSessions.unshift(session);
  // Save to both sync and local
  chrome.storage.sync.set({ savedSessions }, () => {
    chrome.storage.local.set({ savedSessions }, () => {
      document.getElementById('saveDialog').style.display = 'none';
      renderSessions();
    });
  });
});

document.getElementById('btnExportSessions').addEventListener('click',()=>{
  // Always export from latest storage
  chrome.storage.local.get(['savedSessions'], function(r) {
    const sessions = r.savedSessions || savedSessions;
    if (sessions.length === 0) {
      const status = document.getElementById('importStatus');
      status.textContent = '⚠ No sessions to export';
      status.className = 'api-status error';
      setTimeout(() => { status.textContent = ''; }, 2000);
      return;
    }
    const data = JSON.stringify(sessions, null, 2);
    const blob = new Blob([data], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'claritab-sessions.json';
    a.click();
    URL.revokeObjectURL(url);
  });
});

// =============================================
//  IMPORT SESSIONS
// =============================================
document.getElementById('btnImportSessions').addEventListener('click', () => {
  document.getElementById('importFileInput').click();
});

document.getElementById('importFileInput').addEventListener('change', function() {
  const file = this.files[0];
  const status = document.getElementById('importStatus');
  if (!file) return;

  if (!file.name.endsWith('.json')) {
    status.textContent = '\u2717 Please select a .json file';
    status.className = 'api-status error';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid file format');
      const valid = imported.every(s => s.name && Array.isArray(s.tabs));
      if (!valid) throw new Error('File does not look like a Claritab sessions file');

      // Check duplicates by name+savedAt (not name alone)
      const existingKeys = new Set(savedSessions.map(s => s.name + '_' + s.savedAt));
      const newSessions = imported.filter(s => !existingKeys.has(s.name + '_' + s.savedAt));
      const dupeCount = imported.length - newSessions.length;

      if (newSessions.length === 0) {
        // All duplicates — ask user if they want to import anyway
        status.textContent = '\u26a0 All sessions already imported. Rename sessions before re-importing.';
        status.className = 'api-status error';
        return;
      }

      savedSessions = [...newSessions, ...savedSessions];
      saveToStorage({ savedSessions }, () => {
        renderSessions();
        let msg = '\u2713 Imported ' + newSessions.length + ' session' + (newSessions.length !== 1 ? 's' : '');
        if (dupeCount > 0) msg += ' (' + dupeCount + ' duplicate' + (dupeCount !== 1 ? 's' : '') + ' skipped)';
        status.textContent = msg;
        status.className = 'api-status success';
        setTimeout(() => { status.textContent = ''; }, 3000);
      });
    } catch(err) {
      status.textContent = '\u2717 ' + (err.message || 'Could not read file');
      status.className = 'api-status error';
    }
    this.value = '';
  };
  reader.onerror = function() {
    document.getElementById('importStatus').textContent = '\u2717 Could not read file';
    document.getElementById('importStatus').className = 'api-status error';
  };
  reader.readAsText(file);
});

function restoreSession(session) {
  session.tabs.forEach(t=>{ chrome.tabs.create({url:t.url,active:false}); });
}

function timeAgo(ts) {
  const diff=Date.now()-ts; const mins=Math.floor(diff/60000); const hours=Math.floor(mins/60); const days=Math.floor(hours/24);
  if (mins<1) return 'Just now'; if (mins<60) return `${mins}m ago`; if (hours<24) return `${hours}h ago`; return `${days}d ago`;
}

// =============================================
//  TAB HEALTH SCORE
// =============================================
function renderHealth() {
  const issues=document.getElementById('healthIssues');
  const ringFill=document.getElementById('healthRingFill');
  const scoreNum=document.getElementById('healthScoreNum');
  const healthTitle=document.getElementById('healthTitle');
  const healthSub=document.getElementById('healthSub');
  issues.innerHTML='';

  // Find duplicates (same hostname)
  const hostMap={};
  allTabs.forEach(t=>{ try{ const h=new URL(t.url).hostname; hostMap[h]=(hostMap[h]||[]); hostMap[h].push(t); }catch{} });
  const dupeTabs=[];
  Object.values(hostMap).forEach(tabs=>{ if(tabs.length>1) tabs.slice(1).forEach(t=>dupeTabs.push(t)); });

  // Old tabs (no lastAccessed or very old — use index as proxy since lastAccessed may not be available)
  const oldTabs=allTabs.filter(t=>!t.active&&!t.audible).slice(Math.floor(allTabs.length*0.6));

  // Ungrouped
  const groupedIds=new Set(savedGroups.flatMap(g=>g.tabs.map(t=>t.id)));
  const ungrouped=allTabs.filter(t=>!groupedIds.has(t.id));

  // Score calculation
  let score=100;
  if (dupeTabs.length>0)  score-=Math.min(30, dupeTabs.length*8);
  if (oldTabs.length>5)   score-=Math.min(25, (oldTabs.length-5)*3);
  if (allTabs.length>20)  score-=Math.min(20, (allTabs.length-20)*1);
  if (ungrouped.length>10) score-=10;
  score=Math.max(10,Math.round(score));

  // Ring animation
  const circumference=176;
  const offset=circumference-(circumference*(score/100));
  ringFill.style.strokeDashoffset=offset;
  const color=score>=70?'#4ade80':score>=40?'#f59e0b':'#ff5e7a';
  ringFill.style.stroke=color;
  scoreNum.textContent=score;

  // Title
  const label=score>=80?'Excellent':score>=60?'Good':score>=40?'Fair':'Needs work';
  healthTitle.textContent=`Tab health: ${label}`;
  healthSub.textContent=score>=80?'Your tabs are well organised!':`${[dupeTabs.length>0,oldTabs.length>5,ungrouped.length>10].filter(Boolean).length} issue${[dupeTabs.length>0,oldTabs.length>5,ungrouped.length>10].filter(Boolean).length!==1?'s':''} found. Clean up to improve your score.`;

  // Stats
  document.getElementById('statDupes').textContent=dupeTabs.length;
  document.getElementById('statOld').textContent=oldTabs.length;
  document.getElementById('statTotal').textContent=allTabs.length;

  // Issues list
  if (dupeTabs.length>0) {
    const item=makeIssueItem('#ff5e7a',''+dupeTabs.length+' duplicate tabs',dupeTabs.map(t=>cleanUrl(t.url||'')).slice(0,2).join(', '),'Close all',()=>{
      dupeTabs.forEach(t=>chrome.tabs.remove(t.id));
      allTabs=allTabs.filter(t=>!dupeTabs.find(d=>d.id===t.id));
      updateTabCountBadge(allTabs.length); renderHealth();
    });
    issues.appendChild(item);
  }
  if (oldTabs.length>5) {
    const item=makeIssueItem('#f59e0b',''+oldTabs.length+' inactive tabs','Tabs not recently visited','Review',()=>{ switchView('all'); });
    issues.appendChild(item);
  }
  if (ungrouped.length>10) {
    const item=makeIssueItem('#5b8fff',''+ungrouped.length+' ungrouped tabs','Could be better organised','Auto-group',()=>{ switchView('groups'); });
    issues.appendChild(item);
  }
  if (allTabs.length===0||issues.children.length===0) {
    const item=document.createElement('div'); item.style.cssText='text-align:center;padding:16px;color:var(--muted);font-size:12px;'; item.textContent='No issues found. Great job!';
    issues.appendChild(item);
  }

  // Clone and replace btnFixAll to remove all previous listeners
  const oldBtn = document.getElementById('btnFixAll');
  const newBtn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);
  newBtn.addEventListener('click', () => {
    if (dupeTabs.length > 0) {
      dupeTabs.forEach(t => chrome.tabs.remove(t.id));
      allTabs = allTabs.filter(t => !dupeTabs.find(d => d.id === t.id));
      updateTabCountBadge(allTabs.length);
    }
    renderHealth();
  });
}

function makeIssueItem(color, title, desc, fixLabel, fixFn) {
  const item=document.createElement('div'); item.className='issue-item';
  const dot=document.createElement('div'); dot.className='issue-dot'; dot.style.background=color;
  const text=document.createElement('div'); text.className='issue-text';
  const t=document.createElement('div'); t.className='issue-title'; t.textContent=title;
  const d=document.createElement('div'); d.className='issue-desc'; d.textContent=desc;
  text.appendChild(t); text.appendChild(d);
  const fix=document.createElement('button'); fix.className='issue-fix'; fix.textContent=fixLabel;
  fix.addEventListener('click',fixFn);
  item.appendChild(dot); item.appendChild(text); item.appendChild(fix);
  return item;
}

// =============================================
//  AI SUMMARIZE
// =============================================
async function handleSummarize(tab, btn, summaryBox, card) {
  if (summaryBox.classList.contains('visible')) { summaryBox.classList.remove('visible'); return; }
  const r=await new Promise(res=>chrome.storage.local.get(['apiKey'],res));
  if (!r.apiKey) { apiPanel.style.display='flex'; apiStatus.textContent='⚠ Please save your API key first'; apiStatus.className='api-status error'; return; }
  if (!tab.url||tab.url.startsWith('chrome://')||tab.url.startsWith('about:')) { showSummaryText(summaryBox,'⚠ Cannot summarize system pages.'); return; }
  btn.classList.add('loading'); btn.innerHTML='↻'; showSummaryText(summaryBox,'Generating summary...');
  try {
    let pageText='';
    try { const res=await chrome.scripting.executeScript({target:{tabId:tab.id},func:extractPageText}); pageText=res[0]?.result||''; } catch{}
    const data=await callAPI(r.apiKey,`Summarize this webpage in exactly 3 complete sentences. Each sentence must be fully finished. Be specific and informative. Do not start with "This page" or "This article". Do not cut off.\n\nTitle: ${tab.title}\nURL: ${tab.url}\nContent: ${pageText.slice(0,3000)}`,600);
    showSummaryText(summaryBox,data.content?.[0]?.text?.trim()||'No summary available.');
  } catch(err) { showSummaryText(summaryBox,'✗ '+(err.message||'Error')); }
  finally { btn.classList.remove('loading'); btn.innerHTML='✦'; }
}

function showSummaryText(summaryBox, text) {
  const span=summaryBox.querySelector('.summary-text'); if(span) span.textContent=text;
  summaryBox.classList.add('visible');
}

function extractPageText() {
  // Remove unwanted elements directly from live document
  const unwanted = document.querySelectorAll('script,style,nav,header,footer,aside,noscript,iframe');
  const hidden = [];
  unwanted.forEach(el => {
    hidden.push({ el, display: el.style.display });
    el.style.display = 'none';
  });
  // Get text from main content area
  const main = document.querySelector('main,article,[role="main"],#content,.content,.main');
  const text = (main || document.body || document).innerText || '';
  // Restore hidden elements
  hidden.forEach(({ el, display }) => { el.style.display = display; });
  return text.replace(/\s+/g, ' ').trim().slice(0, 4000);
}

// =============================================
//  SHARED API CALL — routes through background.js
//  Background service worker has no CORS restrictions
// =============================================
async function callAPI(apiKey, prompt, maxTokens=800) {
  const provider = selectedProvider || 'claude';

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'API_CALL', apiKey, provider, prompt, maxTokens },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response) {
          reject(new Error('No response from background. Try reloading the extension.'));
          return;
        }
        if (!response.success) {
          reject(new Error(response.error || 'API call failed'));
          return;
        }
        resolve({ content: [{ text: response.text || '' }] });
      }
    );
  });
}


// =============================================
//  KEYBOARD SHORTCUTS + ENTER KEY FIXES
// =============================================

// Enter key on session name input
document.getElementById('sessionNameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnConfirmSave').click();
});

// Enter key on group name input
document.getElementById('groupNameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnConfirmGroup').click();
});

// Enter key on API key input (main settings)
document.getElementById('apiKeyInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('saveApiKey').click();
});

// Enter key on onboarding API input
document.getElementById('obApiInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('obSaveKey').click();
});

// Global keyboard shortcuts
document.addEventListener('keydown', e => {
  // Escape — close any open panel
  if (e.key === 'Escape') {
    if (apiPanel.style.display !== 'none') { apiPanel.style.display = 'none'; return; }
    if (document.getElementById('saveDialog').style.display !== 'none') { document.getElementById('btnCancelSave').click(); return; }
    if (document.getElementById('nameDialog').style.display !== 'none') { document.getElementById('btnCancelName').click(); return; }
    if (document.getElementById('manualPanel').style.display !== 'none') { document.getElementById('btnManualCancel').click(); return; }
  }
  // Ctrl+F or / — focus search when on All Tabs view
  if ((e.key === 'f' && e.ctrlKey) || (e.key === '/' && document.getElementById('viewAll').style.display !== 'none')) {
    e.preventDefault();
    searchInput.focus();
  }
  // Ctrl+G — switch to Groups
  if (e.key === 'g' && e.ctrlKey) { e.preventDefault(); switchView('groups'); }
  // Ctrl+S — switch to Sessions
  if (e.key === 's' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); switchView('sessions'); }
  // Ctrl+H — switch to Health
  if (e.key === 'h' && e.ctrlKey) { e.preventDefault(); switchView('health'); }
});

// =============================================
//  SEARCH
// =============================================
searchInput.addEventListener('input',function(){
  const q=searchInput.value.trim().toLowerCase();
  clearSearch.classList.toggle('visible',q.length>0);
  renderTabs(allTabs.filter(t=>(t.title||'').toLowerCase().includes(q)||(t.url||'').toLowerCase().includes(q)),q);
});
clearSearch.addEventListener('click',()=>{ searchInput.value=''; clearSearch.classList.remove('visible'); renderTabs(allTabs,''); });

// =============================================
//  HELPERS
// =============================================
function switchToTab(tabId, windowId) {
  chrome.tabs.update(tabId, {active:true}, () => {
    if (chrome.runtime.lastError) {
      // Tab ID stale — refresh and try by URL
      console.warn('Tab not found, refreshing list');
      chrome.tabs.query({}, function(tabs) {
        allTabs = tabs;
        updateTabCountBadge(tabs.length);
        renderTabs(tabs);
      });
      return;
    }
    chrome.windows.update(windowId, {focused:true});
    window.close();
  });
}

function closeTab(tabId,cardEl) {
  chrome.tabs.remove(tabId,()=>{
    cardEl.style.transition='opacity .2s,transform .2s,max-height .25s,padding .25s,margin .25s';
    cardEl.style.opacity='0'; cardEl.style.transform='translateX(10px)'; cardEl.style.maxHeight='0'; cardEl.style.padding='0'; cardEl.style.margin='0'; cardEl.style.overflow='hidden';
    setTimeout(()=>{ cardEl.remove(); allTabs=allTabs.filter(t=>t.id!==tabId); updateTabCountBadge(allTabs.length); if(tabList.children.length===0) emptyState.style.display='flex'; },250);
  });
}

function updateTabCountBadge(count) { tabCount.textContent=count+(count===1?' tab':' tabs'); }
function cleanUrl(url) { try{ const u=new URL(url); return u.hostname+(u.pathname!=='/'?u.pathname:''); }catch{ return url; } }
function highlight(text,query) { if(!query) return escapeHtml(text); const e=escapeHtml(text); const q=escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); return e.replace(new RegExp('('+q+')','gi'),'<span class="highlight">$1</span>'); }
function escapeHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function createFavicon(tab) {
  if (tab.favIconUrl&&tab.favIconUrl!=='') { const img=document.createElement('img'); img.className='tab-favicon'; img.src=tab.favIconUrl; img.onerror=()=>img.replaceWith(makeFaviconFallback(tab.title)); return img; }
  return makeFaviconFallback(tab.title);
}
function createFaviconSmall(tab) { const el=createFavicon(tab); el.style.width='14px'; el.style.height='14px'; return el; }
function makeFaviconFallback(title) { const div=document.createElement('div'); div.className='tab-favicon-fallback'; div.textContent=(title||'?')[0].toUpperCase(); return div; }

// =============================================
//  STORAGE HELPER — sync + local fallback
// =============================================
function saveToStorage(data, callback) {
  chrome.storage.sync.set(data, () => {
    if (chrome.runtime.lastError) {
      // Sync full — use local
      chrome.storage.local.set(data, callback);
    } else {
      // Save to both for reliability
      chrome.storage.local.set(data, callback);
    }
  });
}

// =============================================
//  AUTO-SAVE STATUS — show last auto-save time
// =============================================
function checkAutoSaveStatus() {
  chrome.storage.sync.get(['savedSessions'], function(r) {
    if (chrome.runtime.lastError) return;
    const sessions = r.savedSessions || [];
    const autoSession = sessions.find(s => s.autoSaved === true);
    const footer = document.getElementById('filteredCount');
    if (autoSession && footer) {
      const mins = Math.floor((Date.now() - autoSession.savedAt) / 60000);
      if (mins < 60) {
        footer.textContent = '⚡ Auto-saved ' + (mins < 1 ? 'just now' : mins + 'm ago');
      }
    }
  });
}

// Check auto-save status when popup opens
setTimeout(checkAutoSaveStatus, 500);

// Show shortcut hints in footer
const shortcutHints = {
  all:      '<span class="shortcut-key">Ctrl+F</span> search  <span class="shortcut-key">/</span> focus',
  groups:   '<span class="shortcut-key">Ctrl+G</span> groups',
  sessions: '<span class="shortcut-key">Ctrl+S</span> sessions  <span class="shortcut-key">Enter</span> confirm',
  health:   '<span class="shortcut-key">Ctrl+H</span> health',
  focus:    '<span class="shortcut-key">Esc</span> close panel'
};

function updateShortcutHint(view) {
  const el = document.getElementById('shortcutHint');
  if (el) el.innerHTML = shortcutHints[view] || '';
}

// Update hint on initial load
updateShortcutHint('all');

// =============================================
//  PROVIDER UI — main settings panel
// =============================================
function initProviderUI() {
  renderProviderInfo('providerInfo', selectedProvider);
  updateProviderPlaceholder();

  // Wire up provider tab buttons
  document.querySelectorAll('#apiPanel .provider-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#apiPanel .provider-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedProvider = btn.dataset.provider;
      renderProviderInfo('providerInfo', selectedProvider);
      updateProviderPlaceholder();
      apiKeyInput.value = '';
      apiStatus.textContent = '';
    });
  });
}

function updateProviderPlaceholder() {
  const p = PROVIDERS[selectedProvider];
  if (p) apiKeyInput.placeholder = p.placeholder;
}

function renderProviderInfo(containerId, provider) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const p = PROVIDERS[provider];
  if (!p) return;
  const badgeClass = p.badge === 'free' ? 'badge-free' : 'badge-paid';
  const badgeText  = p.badge === 'free' ? 'FREE' : 'PAID';
  el.innerHTML = `
    <span class="provider-info-icon">${p.icon}</span>
    <div class="provider-info-text">
      <div class="provider-info-name">${p.name} <span class="provider-badge ${badgeClass}">${badgeText}</span></div>
      <div class="provider-info-desc">${p.desc}</div>
      <a class="provider-info-link" href="${p.link}" target="_blank">Get key → ${p.linkText}</a>
    </div>`;
}

// =============================================
//  PROVIDER UI — onboarding panel
// =============================================
function initObProviderUI() {
  renderProviderInfo('obProviderInfo', obSelectedProvider);
  updateObHint();

  document.querySelectorAll('#onboarding .provider-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#onboarding .provider-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      obSelectedProvider = btn.dataset.provider;
      selectedProvider   = btn.dataset.provider;
      renderProviderInfo('obProviderInfo', obSelectedProvider);
      updateObHint();
      document.getElementById('obApiInput').value = '';
      document.getElementById('obApiInput').placeholder = PROVIDERS[obSelectedProvider].placeholder;
      document.getElementById('obApiStatus').textContent = '';
    });
  });
}

function updateObHint() {
  const p = PROVIDERS[obSelectedProvider];
  const hint = document.getElementById('obApiHint');
  if (hint && p) hint.innerHTML = `Get yours free at <a href="${p.link}" target="_blank">${p.linkText}</a>`;
}

// Update onboarding save key to use selected provider
document.getElementById('obSaveKey').addEventListener('click', function() {
  const key    = document.getElementById('obApiInput').value.trim();
  const status = document.getElementById('obApiStatus');
  const provider = PROVIDERS[obSelectedProvider];

  if (!provider.validate(key)) {
    status.textContent = '✗ Invalid key. Should start with ' + provider.placeholder;
    status.className   = 'api-status error';
    return;
  }

  chrome.storage.local.set({ apiKey: key, selectedProvider: obSelectedProvider }, function() {
    apiKeyInput.value = key;
    status.textContent = '✓ ' + provider.name + ' key saved!';
    status.className   = 'api-status success';
    document.getElementById('obSuccess').style.display = 'flex';
    setTimeout(() => obNext(), 800);
  });
});
