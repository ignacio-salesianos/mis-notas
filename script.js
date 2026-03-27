document.addEventListener('DOMContentLoaded', () => {

    // ========================================
    // DOM REFERENCES
    // ========================================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const el = {
        grid: $('#notes-grid'),
        emptyState: $('#empty-state'),
        noResults: $('#no-results'),
        searchInput: $('#search-input'),
        clearSearch: $('#clear-search'),
        addBtn: $('#add-note-btn'),
        addAiBtn: $('#add-note-ai-btn'),
        themeToggle: $('#theme-toggle'),
        noteCount: $('#note-count'),

        menuBtn: $('#menu-btn'),
        dropdownMenu: $('#dropdown-menu'),
        exportBtn: $('#export-btn'),
        importBtn: $('#import-btn'),
        importFile: $('#import-file'),
        sortDateBtn: $('#sort-date-btn'),
        sortAlphaBtn: $('#sort-alpha-btn'),

        syncStatus: $('#sync-status'), // Nuevo indicador

        authContainer: $('#auth-container'),
        loginGoogleBtn: $('#login-google-btn'),
        userProfileContainer: $('#user-profile-container'),
        userProfile: $('#user-profile'),
        userAvatar: $('#user-avatar'),
        userName: $('#user-name'),
        userDropdownMenu: $('#user-dropdown-menu'),
        dropdownUserName: $('#dropdown-user-name'),
        dropdownUserEmail: $('#dropdown-user-email'),
        logoutBtn: $('#logout-btn'),

        modal: $('#note-modal'),
        closeModalBtn: $('#close-modal-btn'),
        titleInput: $('#note-title-input'),
        tagsInput: $('#note-tags-input'),
        toolbar: $('#note-toolbar'),
        toolbarBtns: $$('.toolbar-btn:not(.ai-btn)'),
        aiBtns: $$('.ai-btn'),
        bodyInput: $('#note-body-input'),
        previewBody: $('#note-preview'),
        togglePreviewBtn: $('#toggle-preview-btn'),
        fullscreenBtn: $('#fullscreen-btn'),
        downloadNoteBtn: $('#download-note-btn'),
        pinBtn: $('#pin-note-btn'),
        duplicateBtn: $('#duplicate-note-btn'),
        colorDots: $$('.color-dot'),
        saveStatus: $('#save-status'),
        wordCount: $('#word-count'),
        charCount: $('#char-count'),
        dateInfo: $('#note-date-info'),

        toast: $('#toast'),
        toastMessage: $('#toast-message'),
        undoBtn: $('#undo-delete-btn'),
        header: $('.app-header'),

        sidebar: $('#sidebar'),
        mobileMenuBtn: $('#mobile-menu-btn'),
        navAllNotes: $('#nav-all-notes'),
        navSharedNotes: $('#nav-shared-notes'),
        foldersSection: $('#folders-section'),
        folderList: $('#folder-list'),
        addFolderBtn: $('#add-folder-btn'),
        folderModal: $('#folder-modal'),
        closeFolderModalBtn: $('#close-folder-modal-btn'),
        folderNameInput: $('#folder-name-input'),
        cancelFolderBtn: $('#cancel-folder-btn'),
        saveFolderBtn: $('#save-folder-btn'),

        shareModal: $('#share-modal'),
        closeShareModalBtn: $('#close-share-modal-btn'),
        shareEmailInput: $('#share-email-input'),
        cancelShareBtn: $('#cancel-share-btn'),
        saveShareBtn: $('#save-share-btn'),
        sharedUsersList: $('#shared-users-list'),

        noteFolderSelector: $('#note-folder-selector'),
        noteFolderSelect: $('#note-folder-select'),
        folderDropdownBtn: $('#folder-dropdown-btn'),
        folderDropdownText: $('#folder-dropdown-text'),
        folderDropdownMenu: $('#folder-dropdown-menu'),

        aiModal: $('#ai-modal'),
        closeAiModalBtn: $('#close-ai-modal-btn'),
        cancelAiBtn: $('#cancel-ai-btn'),
        saveAiBtn: $('#save-ai-btn'),
        aiTopicInput: $('#ai-topic-input')
    };

    // ========================================
    // STATE
    // ========================================
    const SUPABASE_URL = 'https://csbrquxujvcofgjkqnwb.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_prYpU6J1bAfh5nq7JsXZxA_dERwPrLy';
    const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

    let currentUser   = null;
    let notes         = [];
    let folders       = [];
    let currentNote   = null;
    let deletedNote   = null;
    let autoSaveTimer = null;
    let toastTimer    = null;
    let renderTimer   = null;
    let sortMode      = localStorage.getItem('minimal_sort') || 'date';
    let activeFilter  = 'all';
    let currentShareFolderId = null;
    let realtimeChannel      = null;
    let isPreviewMode        = false;
    let isAppInitialized     = false;

    // Collaborative state
    let colabChannel      = null;
    let isReceivingRemote = false;
    let collaborators     = {};
    let remoteCaretColors = {};
    const COLAB_COLORS    = ['#f59e0b','#10b981','#3b82f6','#ef4444','#a855f7','#ec4899','#06b6d4','#84cc16'];
    let broadcastTimer    = null;
    let typingTimer       = null;
    const remoteCaretEls  = {};

    // ========================================
    // BUILD COLAB UI
    // ========================================
    const typingLabel = document.createElement('span');
    typingLabel.id = 'typing-label';
    typingLabel.style.cssText = 'font-size:.68rem;color:var(--text-muted);font-weight:500;font-style:italic;opacity:0;transition:opacity .3s;white-space:nowrap;margin-right:6px;';

    const colabBar = document.createElement('div');
    colabBar.id = 'colab-bar';
    colabBar.style.cssText = 'display:flex;align-items:center;gap:6px;margin-right:8px;transition:opacity .3s;opacity:0;';

    const saveStatusEl = el.saveStatus;
    saveStatusEl.parentNode.insertBefore(typingLabel, saveStatusEl);
    saveStatusEl.parentNode.insertBefore(colabBar, saveStatusEl);

    const remoteCursorOverlay = document.createElement('div');
    remoteCursorOverlay.id = 'remote-cursor-overlay';
    remoteCursorOverlay.style.cssText = 'position:absolute;pointer-events:none;top:0;left:0;right:0;bottom:0;overflow:hidden;z-index:2;';
    el.bodyInput.parentNode.style.position = 'relative';
    el.bodyInput.parentNode.appendChild(remoteCursorOverlay);

    // ========================================
    // MOBILE FAB
    // ========================================
    function buildMobileFAB() {
        if (document.getElementById('mobile-fab-group')) return;
        const group = document.createElement('div');
        group.id = 'mobile-fab-group';
        group.className = 'mobile-fab-group';

        const fabNew = document.createElement('button');
        fabNew.className = 'mobile-fab primary';
        fabNew.innerHTML = '<i class="fa-solid fa-plus"></i>';
        fabNew.setAttribute('aria-label', 'Nueva nota');
        fabNew.addEventListener('click', () => openModal());

        const fabAi = document.createElement('button');
        fabAi.className = 'mobile-fab ai';
        fabAi.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
        fabAi.setAttribute('aria-label', 'Generar con IA');
        fabAi.addEventListener('click', openAiModal);

        group.appendChild(fabAi);
        group.appendChild(fabNew);
        document.body.appendChild(group);
    }

    function syncMobileFAB() {
        const fab = document.getElementById('mobile-fab-group');
        if (window.innerWidth <= 768 && !fab) buildMobileFAB();
        if (window.innerWidth > 768  &&  fab) fab.remove();
    }
    syncMobileFAB();
    window.addEventListener('resize', syncMobileFAB);

    // ========================================
    // THEME INIT
    // ========================================
    const savedTheme = localStorage.getItem('minimal_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);


    // ========================================
    // EVENT LISTENERS
    // ========================================
    el.addBtn.addEventListener('click', () => openModal());
    el.addAiBtn?.addEventListener('click', openAiModal);
    el.closeAiModalBtn?.addEventListener('click', () => el.aiModal.classList.add('hidden'));
    el.cancelAiBtn?.addEventListener('click',     () => el.aiModal.classList.add('hidden'));
    el.saveAiBtn?.addEventListener('click', handleGenerateAI);

    el.themeToggle.addEventListener('click', toggleTheme);

    el.mobileMenuBtn?.addEventListener('click', () => el.sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && el.sidebar.classList.contains('open') &&
            !el.sidebar.contains(e.target) && !el.mobileMenuBtn?.contains(e.target)) {
            el.sidebar.classList.remove('open');
        }
    });

    el.navAllNotes.addEventListener('click', () => {
        activeFilter = 'all';
        el.header.querySelector('#header-title').textContent = 'Todas mis notas';
        updateSidebarActive(el.navAllNotes);
        renderNotes(el.searchInput.value, true);
    });
    el.navSharedNotes?.addEventListener('click', () => {
        activeFilter = 'shared';
        el.header.querySelector('#header-title').textContent = 'Compartidas conmigo';
        updateSidebarActive(el.navSharedNotes);
        renderNotes(el.searchInput.value, true);
    });

    el.addFolderBtn.addEventListener('click', () => {
        el.folderNameInput.value = '';
        el.folderModal.classList.remove('hidden');
        setTimeout(() => el.folderNameInput.focus(), 50);
    });
    el.closeFolderModalBtn.addEventListener('click', () => el.folderModal.classList.add('hidden'));
    el.cancelFolderBtn.addEventListener('click',     () => el.folderModal.classList.add('hidden'));
    el.saveFolderBtn.addEventListener('click', createFolder);
    el.folderNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  createFolder();
        if (e.key === 'Escape') el.folderModal.classList.add('hidden');
    });

    el.closeShareModalBtn?.addEventListener('click', () => el.shareModal.classList.add('hidden'));
    el.cancelShareBtn?.addEventListener('click',     () => el.shareModal.classList.add('hidden'));
    el.saveShareBtn?.addEventListener('click', shareFolder);

    window.addEventListener('scroll', () => el.header.classList.toggle('scrolled', window.scrollY > 10), { passive: true });

    el.searchInput.addEventListener('input', (e) => {
        el.clearSearch.classList.toggle('hidden', !e.target.value);
        debouncedRender(e.target.value);
    });
    el.clearSearch.addEventListener('click', () => {
        el.searchInput.value = '';
        el.clearSearch.classList.add('hidden');
        renderNotes('', false);
        el.searchInput.focus();
    });

    el.menuBtn.addEventListener('click', (e) => { e.stopPropagation(); el.dropdownMenu.classList.toggle('hidden'); });
    el.folderDropdownBtn?.addEventListener('click', (e) => { e.stopPropagation(); el.folderDropdownMenu?.classList.toggle('hidden'); });
    document.addEventListener('click', () => {
        el.dropdownMenu.classList.add('hidden');
        el.folderDropdownMenu?.classList.add('hidden');
    });

    el.exportBtn.addEventListener('click', exportNotes);
    el.importBtn.addEventListener('click', () => el.importFile.click());
    el.importFile.addEventListener('change', importNotes);
    el.sortDateBtn.addEventListener('click', () => setSortMode('date'));
    el.sortAlphaBtn.addEventListener('click', () => setSortMode('alpha'));

    el.loginGoogleBtn?.addEventListener('click', async () => {
        if (!supabase) return;
        await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin, queryParams: { access_type: 'offline', prompt: 'consent' } } });
    });
    el.userProfile?.addEventListener('click', (e) => { e.stopPropagation(); el.userDropdownMenu.classList.toggle('show'); });
    document.addEventListener('click', (e) => { if (!e.target.closest('#user-profile-container')) el.userDropdownMenu?.classList.remove('show'); });
    el.logoutBtn?.addEventListener('click', async () => {
        if (!supabase) return;
        leaveColabChannel();
        if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
        await supabase.auth.signOut();
        notes = []; el.userDropdownMenu.classList.remove('show');
        saveToStorage(); renderNotes('', true);
    });

    // Grid
    el.grid.addEventListener('click', (e) => {
        const card  = e.target.closest('.note-card');
        const delBtn = e.target.closest('.delete-card-btn');
        const dupBtn = e.target.closest('.dup-card-btn');
        if (!card) return;
        if (delBtn) { e.stopPropagation(); deleteNote(card.dataset.id); return; }
        if (dupBtn) { e.stopPropagation(); duplicateNote(card.dataset.id); return; }
        const note = notes.find(n => n.id === card.dataset.id);
        if (note) openModal(note);
    });

    // Modal basics
    el.closeModalBtn.addEventListener('click', closeModal);
    el.modal.addEventListener('click', (e) => { if (e.target.classList.contains('modal-backdrop')) closeModal(); });

    el.titleInput.addEventListener('input', () => { updateCounts(); triggerAutoSave(); broadcastContent(); });
    el.bodyInput.addEventListener('input',  () => { updateCounts(); triggerAutoSave(); broadcastContent(); });
    el.bodyInput.addEventListener('keyup',  broadcastContent);
    el.bodyInput.addEventListener('click',  broadcastContent);

    el.bodyInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        e.preventDefault();
        const s = el.bodyInput.selectionStart, end = el.bodyInput.selectionEnd;
        el.bodyInput.value = el.bodyInput.value.substring(0, s) + '    ' + el.bodyInput.value.substring(end);
        el.bodyInput.selectionStart = el.bodyInput.selectionEnd = s + 4;
        triggerAutoSave(); broadcastContent();
    });

    el.previewBody.classList.add('editable-hint');
    el.previewBody.addEventListener('dblclick', () => { if (isPreviewMode) switchToEditMode(); });

    let _tapCount = 0, _tapTimer = null;
    el.previewBody.addEventListener('click', () => {
        if (!isPreviewMode) return;
        _tapCount++;
        clearTimeout(_tapTimer);
        _tapTimer = setTimeout(() => { _tapCount = 0; }, 400);
        if (_tapCount >= 3) { _tapCount = 0; switchToEditMode(); }
    });

    el.pinBtn.addEventListener('click', () => {
        if (!currentNote) return;
        currentNote.pinned = !currentNote.pinned;
        el.pinBtn.classList.toggle('active', currentNote.pinned);
        triggerAutoSave(true);
    });
    el.duplicateBtn.addEventListener('click', () => {
        if (!currentNote) return;
        const newNote = { id: generateId(), title: (currentNote.title || '') + ' (copia)', tags: [...(currentNote.tags || [])], body: el.bodyInput.value, pinned: false, color: currentNote.color, createdAt: Date.now(), updatedAt: Date.now() };
        notes.push(newNote);
        saveToStorage(); 
        if(currentUser) syncNoteToSupabase(newNote);
        showToast('Nota duplicada');
    });

    el.togglePreviewBtn.addEventListener('click', () => { isPreviewMode ? switchToEditMode() : switchToPreviewMode(); });

    el.fullscreenBtn?.addEventListener('click', () => {
        el.modal.classList.toggle('fullscreen');
        el.fullscreenBtn.querySelector('i').className = el.modal.classList.contains('fullscreen') ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
    });

    el.downloadNoteBtn.addEventListener('click', () => {
        if (!currentNote) return;
        const content = `${el.titleInput.value ? '# ' + el.titleInput.value + '\n\n' : ''}${el.bodyInput.value}`;
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([content], { type: 'text/markdown' })), download: `${(el.titleInput.value || 'nota').toLowerCase().replace(/\s+/g, '_')}.md` });
        a.click();
    });

    el.colorDots.forEach(dot => dot.addEventListener('click', () => {
        if (!currentNote) return;
        currentNote.color = dot.dataset.color;
        setActiveColorDot(dot.dataset.color);
        triggerAutoSave(true);
    }));

    el.toolbarBtns.forEach(btn => btn.addEventListener('click', () => { applyToolbarAction(btn.dataset.action); broadcastContent(); }));
    el.aiBtns.forEach(btn => btn.addEventListener('click', () => handleAiToolbar(btn.dataset.action)));

    el.undoBtn.addEventListener('click', () => {
        if (!deletedNote) return;
        notes.push(deletedNote);
        saveToStorage();
        if (currentUser) syncNoteToSupabase(deletedNote);
        deletedNote = null;
        renderNotes(el.searchInput.value, false);
        hideToast();
    });

    // ========================================
    // PREVIEW ↔ EDIT
    // ========================================
    function switchToPreviewMode() {
        isPreviewMode = true;
        el.bodyInput.classList.add('hidden');
        el.previewBody.classList.remove('hidden');
        el.toolbar.classList.add('hidden');
        remoteCursorOverlay.style.display = 'none';
        el.togglePreviewBtn.querySelector('i').className = 'fa-solid fa-pen';
        renderPreview();
    }

    function switchToEditMode() {
        isPreviewMode = false;
        el.bodyInput.classList.remove('hidden');
        el.previewBody.classList.add('hidden');
        el.toolbar.classList.remove('hidden');
        remoteCursorOverlay.style.display = 'block';
        el.togglePreviewBtn.querySelector('i').className = 'fa-solid fa-eye';
        setTimeout(() => { el.bodyInput.focus(); el.bodyInput.selectionStart = el.bodyInput.value.length; }, 30);
    }

    function renderPreview() {
        const raw = el.bodyInput.value || '*Nada que previsualizar*';
        let html = typeof marked !== 'undefined' ? marked.parse(raw) : `<p>${esc(raw)}</p>`;
        html = html
            .replace(/<input disabled="" type="checkbox"/g, '<input type="checkbox" class="interactive-checkbox"')
            .replace(/<input type="checkbox" disabled=""/g, '<input type="checkbox" class="interactive-checkbox"');
        el.previewBody.innerHTML = html;
        setTimeout(() => {
            el.previewBody.querySelectorAll('.interactive-checkbox').forEach((cb, i) => {
                cb.addEventListener('change', (e) => toggleMarkdownCheckbox(i, e.target.checked));
            });
        }, 10);
    }

    function toggleMarkdownCheckbox(idx, checked) {
        if (!currentNote) return;
        let i = 0;
        el.bodyInput.value = el.bodyInput.value.replace(/- \[[ xX]\]/g, m => i++ === idx ? (checked ? '- [x]' : '- [ ]') : m);
        currentNote.body = el.bodyInput.value;
        triggerAutoSave(true); broadcastContent();
    }

    // ========================================
    // TOOLBAR & AI
    // ========================================
    function applyToolbarAction(action) {
        const s = el.bodyInput.selectionStart, e2 = el.bodyInput.selectionEnd;
        const text = el.bodyInput.value, sel = text.substring(s, e2);
        const map = {
            bold:          [`**${sel || ''}**`,              sel ? s + sel.length + 4 : s + 2],
            italic:        [`*${sel || ''}*`,               sel ? s + sel.length + 2 : s + 1],
            strikethrough: [`~~${sel || ''}~~`,             sel ? s + sel.length + 4 : s + 2],
            list:          [`\n- ${sel || 'ítem'}`,          s + (sel.length || 4) + 3],
            checklist:     [`\n- [ ] ${sel || 'tarea'}`,    s + (sel.length || 5) + 7],
            code:          [`\n\`\`\`\n${sel || 'código'}\n\`\`\`\n`, s + (sel.length || 7) + 9]
        };
        if (!map[action]) return;
        const [ins, cur] = map[action];
        el.bodyInput.value = text.substring(0, s) + ins + text.substring(e2);
        el.bodyInput.focus();
        el.bodyInput.selectionStart = el.bodyInput.selectionEnd = cur;
        triggerAutoSave();
    }

    async function handleAiToolbar(action) {
        if (!currentNote) return;
        const s = el.bodyInput.selectionStart, e2 = el.bodyInput.selectionEnd;
        const full = el.bodyInput.value, sel = full.substring(s, e2), text = sel || full;
        if (!text.trim()) { showToast('Escribe algo primero'); return; }
        showToast('Procesando con IA...');
        const base = 'Responde ÚNICAMENTE con el contenido solicitado. Sin saludos ni bloques de código envolventes.';
        const prompts = {
            'ai-order':     `Organiza el siguiente texto en una lista de puntos clave. ${base}:\n\n${text}`,
            'ai-summarize': `Resume este texto de forma concisa. ${base}:\n\n${text}`,
            'ai-extend':    `Extiende y desarrolla esta idea con contexto y ejemplos. ${base}:\n\n${text}`
        };
        const result = await generateAIContent(prompts[action]);
        if (result) {
            el.bodyInput.value = sel ? full.substring(0, s) + result + full.substring(e2) : result;
            triggerAutoSave(); updateCounts(); broadcastContent(); hideToast();
        } else { showToast('Error con la IA'); }
    }

    function openAiModal() {
        el.aiTopicInput.value = '';
        el.aiModal.classList.remove('hidden');
        setTimeout(() => el.aiTopicInput.focus(), 50);
    }

    async function handleGenerateAI() {
        const topic = el.aiTopicInput.value.trim();
        if (!topic) return;
        el.saveAiBtn.disabled = true;
        el.saveAiBtn.innerHTML = 'Generando... <i class="fa-solid fa-spinner fa-spin"></i>';
        showToast('Generando nota...');

        const content = await generateAIContent(
            `Crea una nota clara y estructurada sobre: ${topic}. Responde ÚNICAMENTE con el contenido. Sin saludos ni bloques de código markdown. Usa markdown pero SIN título h1 al inicio.`
        );
        if (content) {
            const newNote = {
                id: generateId(), title: topic.charAt(0).toUpperCase() + topic.slice(1),
                tags: ['IA'], body: content, pinned: false, color: 'default',
                folder_id: activeFilter !== 'all' && activeFilter !== 'shared' ? activeFilter : null,
                createdAt: Date.now(), updatedAt: Date.now()
            };
            notes.push(newNote); saveToStorage();
            if (currentUser) syncNoteToSupabase(newNote);
            renderNotes(el.searchInput.value, true);
            hideToast(); el.aiModal.classList.add('hidden');
            openModal(newNote);
        } else { showToast('Error al generar la nota'); }

        el.saveAiBtn.disabled = false;
        el.saveAiBtn.innerHTML = 'Generar <i class="fa-solid fa-wand-magic-sparkles"></i>';
    }

    // ========================================
    // REALTIME COLLABORATION
    // ========================================
    function joinColabChannel(noteId) {
        leaveColabChannel();
        if (!supabase || !currentUser || !noteId) return;

        collaborators = {}; remoteCaretColors = {};
        updateColabBar();

        colabChannel = supabase.channel(`note-colab-${noteId}`, { config: { broadcast: { self: false } } });

        colabChannel.on('broadcast', { event: 'typing' }, ({ payload }) => {
            if (!payload || payload.userId === currentUser?.id) return;
            isReceivingRemote = true;

            if (payload.title !== undefined && el.titleInput.value !== payload.title) {
                const pos = el.titleInput.selectionStart;
                el.titleInput.value = payload.title;
                try { el.titleInput.setSelectionRange(pos, pos); } catch(_) {}
            }

            if (payload.body !== undefined && el.bodyInput.value !== payload.body) {
                const pos = el.bodyInput.selectionStart;
                el.bodyInput.value = payload.body;
                try { el.bodyInput.setSelectionRange(pos, pos); } catch(_) {}
                updateCounts();
            }

            if (isPreviewMode) renderPreview();

            if (payload.caretPos !== undefined) showRemoteCaret(payload.userId, payload.caretPos, payload.color);

            isReceivingRemote = false;

            if (currentNote) { currentNote.title = el.titleInput.value; currentNote.body = el.bodyInput.value; }
            showTypingLabel(`${collaborators[payload.userId]?.name || 'Alguien'} está escribiendo...`);
        });

        colabChannel.on('presence', { event: 'sync' }, () => {
            collaborators = {}; let idx = 0;
            Object.values(colabChannel.presenceState()).flat().forEach(p => {
                if (p.userId === currentUser?.id) return;
                const color = remoteCaretColors[p.userId] || COLAB_COLORS[idx++ % COLAB_COLORS.length];
                remoteCaretColors[p.userId] = color;
                collaborators[p.userId] = { name: p.name || 'Anónimo', avatar: p.avatar || null, color };
            });
            updateColabBar();
        });

        colabChannel.on('presence', { event: 'join' }, ({ newPresences }) => {
            newPresences.forEach(p => {
                if (p.userId === currentUser?.id) return;
                const color = remoteCaretColors[p.userId] || COLAB_COLORS[Object.keys(remoteCaretColors).length % COLAB_COLORS.length];
                remoteCaretColors[p.userId] = color;
                collaborators[p.userId] = { name: p.name || 'Anónimo', avatar: p.avatar || null, color };
                updateColabBar();
                showTypingLabel(`${p.name || 'Alguien'} se unió`);
            });
        });

        colabChannel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
            leftPresences.forEach(p => {
                if (p.userId === currentUser?.id) return;
                delete collaborators[p.userId]; delete remoteCaretColors[p.userId];
                removeRemoteCaret(p.userId); updateColabBar();
            });
        });

        colabChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await colabChannel.track({
                    userId: currentUser.id,
                    name:   currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Tú',
                    avatar: currentUser.user_metadata?.avatar_url || null,
                    noteId
                });
            }
        });
    }

    function leaveColabChannel() {
        if (colabChannel) { supabase?.removeChannel(colabChannel); colabChannel = null; }
        collaborators = {}; remoteCaretColors = {};
        remoteCursorOverlay.innerHTML = '';
        Object.keys(remoteCaretEls).forEach(k => { try { remoteCaretEls[k].remove(); } catch(_){} delete remoteCaretEls[k]; });
        updateColabBar();
        typingLabel.style.opacity = '0';
    }

    function broadcastContent() {
        if (!colabChannel || !currentUser || isReceivingRemote) return;
        clearTimeout(broadcastTimer);
        broadcastTimer = setTimeout(() => {
            colabChannel.send({
                type: 'broadcast', event: 'typing',
                payload: {
                    userId:   currentUser.id,
                    title:    el.titleInput.value,
                    body:     el.bodyInput.value,
                    caretPos: el.bodyInput.selectionStart,
                    color:    remoteCaretColors[currentUser.id] || COLAB_COLORS[0]
                }
            });
        }, 60);
    }

    function showRemoteCaret(userId, caretPos, color) {
        if (!el.bodyInput || isPreviewMode) return;
        const coords = getCaretCoordinates(el.bodyInput, caretPos);
        if (!coords) return;

        let el2 = remoteCaretEls[userId];
        if (!el2) {
            el2 = document.createElement('div');
            el2.style.cssText = 'position:absolute;width:2px;border-radius:2px;pointer-events:none;transition:top .1s,left .1s;z-index:3;';
            const lbl = document.createElement('span');
            lbl.style.cssText = 'position:absolute;top:-18px;left:0;font-size:10px;font-weight:600;padding:1px 5px;border-radius:4px;white-space:nowrap;pointer-events:none;font-family:inherit;color:#fff;';
            el2.appendChild(lbl);
            remoteCursorOverlay.appendChild(el2);
            remoteCaretEls[userId] = el2;
        }
        const c = color || '#f59e0b';
        el2.style.background = c;
        el2.style.height  = `${coords.height}px`;
        el2.style.top     = `${coords.top - el.bodyInput.scrollTop}px`;
        el2.style.left    = `${coords.left}px`;
        el2.style.opacity = '1';
        el2.querySelector('span').textContent  = collaborators[userId]?.name?.split(' ')[0] || '?';
        el2.querySelector('span').style.background = c;
        clearTimeout(el2._fade);
        el2._fade = setTimeout(() => { el2.style.opacity = '0'; }, 3000);
    }

    function removeRemoteCaret(userId) {
        const el2 = remoteCaretEls[userId];
        if (el2) { el2.remove(); delete remoteCaretEls[userId]; }
    }

    function getCaretCoordinates(textarea, position) {
        try {
            const div = document.createElement('div');
            const cs  = getComputedStyle(textarea);
            ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing',
             'paddingTop','paddingBottom','paddingLeft','paddingRight',
             'borderTopWidth','borderBottomWidth','borderLeftWidth','borderRightWidth',
             'width','boxSizing','whiteSpace','wordWrap','overflowWrap'].forEach(p => div.style[p] = cs[p]);
            div.style.cssText += ';position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;';
            div.textContent = textarea.value.substring(0, position);
            const span = document.createElement('span'); span.textContent = '|';
            div.appendChild(span); document.body.appendChild(div);
            const sr = span.getBoundingClientRect(), dr = div.getBoundingClientRect();
            document.body.removeChild(div);
            return { top: sr.top - dr.top + textarea.offsetTop, left: sr.left - dr.left + textarea.offsetLeft, height: sr.height };
        } catch(_) { return null; }
    }

    function updateColabBar() {
        colabBar.innerHTML = '';
        const entries = Object.entries(collaborators);
        colabBar.style.opacity = entries.length ? '1' : '0';
        entries.forEach(([, info]) => {
            const av = document.createElement('div');
            av.title = info.name;
            av.style.cssText = `width:26px;height:26px;border-radius:50%;border:2px solid ${info.color};overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${info.color}22;font-size:11px;font-weight:700;color:${info.color};cursor:default;transition:transform .2s;`;
            av.onmouseenter = () => av.style.transform = 'scale(1.15)';
            av.onmouseleave = () => av.style.transform = 'scale(1)';
            if (info.avatar) {
                const img = document.createElement('img');
                img.src = info.avatar; img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                img.onerror = () => { av.textContent = info.name?.[0]?.toUpperCase() || '?'; };
                av.appendChild(img);
            } else { av.textContent = info.name?.[0]?.toUpperCase() || '?'; }
            colabBar.appendChild(av);
        });
    }

    function showTypingLabel(text) {
        typingLabel.textContent = text;
        typingLabel.style.opacity = '1';
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => { typingLabel.style.opacity = '0'; }, 2500);
    }

    // ========================================
    // STORAGE & SUPABASE
    // ========================================
    function saveToStorage() {
        localStorage.setItem(currentUser ? `minimal_notes_${currentUser.id}` : 'minimal_notes', JSON.stringify(notes));
    }

    async function syncNoteToSupabase(note) {
        if (!currentUser || !supabase) return;
        try {
            el.syncStatus?.classList.remove('hidden');
            await supabase.from('notes').upsert({
                id: note.id, user_id: note.user_id || currentUser.id, folder_id: note.folder_id,
                title: note.title, tags: note.tags, body: note.body, pinned: note.pinned, color: note.color,
                created_at: new Date(note.createdAt).toISOString(), updated_at: new Date(note.updatedAt).toISOString()
            }, { onConflict: 'id' });
        } catch(e) { console.error('syncNote:', e); }
        finally { el.syncStatus?.classList.add('hidden'); }
    }

    async function deleteNoteFromSupabase(noteId) {
        if (!currentUser || !supabase) return;
        try { await supabase.from('notes').delete().eq('id', noteId).eq('user_id', currentUser.id); }
        catch(e) { console.error('deleteNote:', e); }
    }

    async function loadNotesFromSupabase() {
        if (!currentUser || !supabase) return;
        try {
            el.syncStatus?.classList.remove('hidden');
            const { data, error } = await supabase.from('notes').select('*');
            if (error) { showToast('Error cargando notas'); return; }
            if (data?.length) {
                notes = data.map(n => ({
                    id: n.id, title: n.title, tags: n.tags || [], body: n.body, pinned: n.pinned,
                    color: n.color, folder_id: n.folder_id, user_id: n.user_id,
                    shared: n.user_id !== currentUser.id,
                    createdAt: new Date(n.created_at).getTime(), updatedAt: new Date(n.updated_at).getTime()
                }));
                saveToStorage(); 
                renderNotes(el.searchInput.value, false); // No animar en background sync
            }
        } catch(e) { console.error('loadNotes:', e); }
        finally { el.syncStatus?.classList.add('hidden'); }
    }

    async function loadFoldersFromSupabase() {
        if (!currentUser || !supabase) return;
        try {
            const { data, error } = await supabase.from('folders').select('*').order('name');
            if (!error) { folders = data || []; saveFoldersToStorage(); renderFoldersSidebar(); updateFolderSelects(); }
        } catch(e) { console.error('loadFolders:', e); }
    }

    function saveFoldersToStorage() { localStorage.setItem('minimal_folders', JSON.stringify(folders)); }

    // ========================================
    // FOLDERS
    // ========================================
    async function createFolder() {
        const name = el.folderNameInput.value.trim();
        if (!name || !currentUser || !supabase) return;
        el.saveFolderBtn.disabled = true; el.saveFolderBtn.textContent = 'Creando...';
        try {
            const { data, error } = await supabase.from('folders').insert([{ user_id: currentUser.id, name }]).select().single();
            if (error) { showToast('Error al crear carpeta'); }
            else if (data) {
                folders.push(data); folders.sort((a,b) => a.name.localeCompare(b.name));
                saveFoldersToStorage(); renderFoldersSidebar(); updateFolderSelects();
                showToast('Carpeta creada'); el.folderModal.classList.add('hidden');
            }
        } finally { el.saveFolderBtn.disabled = false; el.saveFolderBtn.textContent = 'Crear'; }
    }

    function renderFoldersSidebar() {
        el.folderList.innerHTML = '';
        if (!currentUser) return;
        folders.forEach(folder => {
            const isOwner = folder.user_id === currentUser.id;
            const li = document.createElement('li');
            li.className = `folder-item${activeFilter === folder.id ? ' active' : ''}`;
            li.dataset.id = folder.id;
            li.innerHTML = `
                <div class="folder-item-content">
                    <i class="fa-${isOwner ? 'regular fa-folder' : 'solid fa-folder-user'}"></i>
                    <span class="folder-name-text" title="${folder.name}">${esc(folder.name)}</span>
                </div>
                ${isOwner ? `<div class="folder-actions">
                    <button class="icon-btn small share-folder-btn" title="Compartir"><i class="fa-solid fa-user-plus"></i></button>
                    <button class="icon-btn small delete-folder-btn text-danger" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </div>` : ''}`;
            li.addEventListener('click', (e) => {
                if (e.target.closest('.share-folder-btn') || e.target.closest('.delete-folder-btn')) return;
                activeFilter = folder.id;
                el.header.querySelector('#header-title').textContent = folder.name;
                updateSidebarActive(li); renderNotes(el.searchInput.value, true);
            });
            li.querySelector('.delete-folder-btn')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`¿Eliminar "${folder.name}"? Las notas también se eliminarán.`)) await deleteFolder(folder.id);
            });
            li.querySelector('.share-folder-btn')?.addEventListener('click', (e) => { e.stopPropagation(); openShareModal(folder.id, folder.name); });
            el.folderList.appendChild(li);
        });
    }

    async function deleteFolder(id) {
        if (!currentUser || !supabase) return;
        const { error } = await supabase.from('folders').delete().eq('id', id);
        if (!error) {
            folders = folders.filter(f => f.id !== id);
            notes   = notes.filter(n => n.folder_id !== id);
            saveFoldersToStorage(); saveToStorage();
            if (activeFilter === id) el.navAllNotes.click();
            else { renderFoldersSidebar(); renderNotes('', false); }
            showToast('Carpeta eliminada');
        } else showToast('Error al eliminar');
    }

    function updateSidebarActive(activeEl) {
        $$('.nav-item, .folder-item').forEach(x => x.classList.remove('active'));
        activeEl?.classList.add('active');
        if (window.innerWidth <= 768) el.sidebar.classList.remove('open');
    }

    function updateFolderSelects() {
        if (!el.folderDropdownMenu) return;
        el.folderDropdownMenu.innerHTML = `<button class="dropdown-item active" data-folder-id=""><i class="fa-solid fa-folder-minus"></i> Sin carpeta</button>`;
        folders.forEach(f => {
            const btn = document.createElement('button');
            btn.className = 'dropdown-item'; btn.dataset.folderId = f.id;
            btn.innerHTML = `<i class="fa-regular fa-folder"></i> ${esc(f.name)}`;
            el.folderDropdownMenu.appendChild(btn);
        });
        el.folderDropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                el.noteFolderSelect.value = item.dataset.folderId;
                el.folderDropdownMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                el.folderDropdownMenu.classList.add('hidden');
                syncFolderDropdownText();
                if (currentNote) { currentNote.folder_id = item.dataset.folderId || null; triggerAutoSave(true); }
            });
        });
        syncFolderDropdownText();
    }

    function syncFolderDropdownText() {
        if (!el.noteFolderSelect || !el.folderDropdownText || !el.folderDropdownMenu) return;
        const val = el.noteFolderSelect.value || '';
        let found = false;
        el.folderDropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.folderId === val) { item.classList.add('active'); el.folderDropdownText.textContent = item.textContent.trim(); found = true; }
        });
        if (!found) { el.folderDropdownText.textContent = 'Sin carpeta'; el.folderDropdownMenu.querySelector('.dropdown-item')?.classList.add('active'); }
    }

    // ========================================
    // SHARE
    // ========================================
    async function openShareModal(folderId, folderName) {
        currentShareFolderId = folderId;
        el.shareEmailInput.value = '';
        el.shareModal.querySelector('h3').textContent = `Compartir "${folderName}"`;
        el.sharedUsersList.innerHTML = '<p style="color:var(--text-muted);font-size:.8rem">Cargando...</p>';
        el.shareModal.classList.remove('hidden');
        try {
            const { data, error } = await supabase.from('shared_folders').select('shared_with_email').eq('folder_id', folderId);
            if (error) throw error;
            el.sharedUsersList.innerHTML = '';
            if (data?.length) {
                data.forEach(share => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:.5rem;border-bottom:1px solid var(--border-color);font-size:.9rem;';
                    row.innerHTML = `<span>${esc(share.shared_with_email)}</span><button class="icon-btn small text-danger remove-share-btn"><i class="fa-solid fa-xmark"></i></button>`;
                    row.querySelector('.remove-share-btn').addEventListener('click', () => removeShare(folderId, share.shared_with_email, row));
                    el.sharedUsersList.appendChild(row);
                });
            } else { el.sharedUsersList.innerHTML = '<p style="color:var(--text-muted);font-size:.8rem">Nadie tiene acceso aún.</p>'; }
        } catch(_) { el.sharedUsersList.innerHTML = '<p style="color:#ef4444;font-size:.8rem">Error al cargar.</p>'; }
    }

    async function shareFolder() {
        if (!currentShareFolderId || !supabase) return;
        const email = el.shareEmailInput.value.trim().toLowerCase();
        if (!email?.includes('@')) { showToast('Email inválido'); return; }
        el.saveShareBtn.disabled = true;
        try {
            const { error } = await supabase.from('shared_folders').insert([{ folder_id: currentShareFolderId, shared_with_email: email }]);
            if (error) showToast(error.code === '23505' ? 'Ya tiene acceso' : 'Error al compartir');
            else { showToast(`Compartido con ${email}`); el.shareEmailInput.value = ''; openShareModal(currentShareFolderId, el.shareModal.querySelector('h3').textContent.replace(/Compartir "|"/g,'')); }
        } finally { el.saveShareBtn.disabled = false; }
    }

    async function removeShare(folderId, email, row) {
        row.style.opacity = '.5';
        const { error } = await supabase.from('shared_folders').delete().match({ folder_id: folderId, shared_with_email: email });
        if (!error) { row.remove(); if (!el.sharedUsersList.children.length) el.sharedUsersList.innerHTML = '<p style="color:var(--text-muted);font-size:.8rem">Nadie tiene acceso aún.</p>'; }
        else { showToast('Error al revocar'); row.style.opacity = '1'; }
    }

    // ========================================
    // AUTH & INITIALIZATION
    // ========================================
    function setupRealtimeSubscriptions() {
        if (!currentUser || !supabase) return;
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        realtimeChannel = supabase.channel('global-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_folders' }, () => Promise.all([loadFoldersFromSupabase(), loadNotesFromSupabase()]))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' },         () => Promise.all([loadFoldersFromSupabase(), loadNotesFromSupabase()]))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' },           (p) => { if (p.new?.user_id !== currentUser?.id) loadNotesFromSupabase(); })
            .subscribe();
    }

    async function handleSession(session, isInitialBoot = false) {
        currentUser = session?.user || null;
        if (currentUser) {
            el.loginGoogleBtn.style.display = 'none';
            el.userProfileContainer?.classList.remove('hidden');
            el.userProfile.classList.remove('hidden');
            const avatar = currentUser.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar/?d=mp';
            const name   = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Usuario';
            el.userAvatar.src = avatar;
            if (el.userName)          el.userName.textContent          = name;
            if (el.dropdownUserName)  el.dropdownUserName.textContent  = name;
            if (el.dropdownUserEmail) el.dropdownUserEmail.textContent = currentUser.email;
            
            notes = JSON.parse(localStorage.getItem(`minimal_notes_${currentUser.id}`)) || [];
            
            el.foldersSection.classList.remove('hidden');
            el.noteFolderSelector.classList.remove('hidden');
            el.navSharedNotes?.classList.remove('hidden');
            
            // Render optimista local rápido
            renderNotes(el.searchInput.value, isInitialBoot);

            Promise.all([loadFoldersFromSupabase(), loadNotesFromSupabase()]).then(() => {
                renderFoldersSidebar(); 
                if (isInitialBoot) setupRealtimeSubscriptions();
            });
        } else {
            el.loginGoogleBtn.style.display = 'flex';
            el.userProfileContainer?.classList.add('hidden');
            el.userDropdownMenu?.classList.remove('show');
            el.foldersSection.classList.add('hidden');
            el.noteFolderSelector.classList.add('hidden');
            el.navSharedNotes?.classList.add('hidden');
            activeFilter = 'all'; updateSidebarActive(el.navAllNotes);
            leaveColabChannel();
            if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
            notes = JSON.parse(localStorage.getItem('minimal_notes')) || [];
            folders = [];
            renderFoldersSidebar(); 
            renderNotes(el.searchInput.value, isInitialBoot);
        }
    }

    async function initApp() {
        if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            await handleSession(session, true);
        } else {
            notes = JSON.parse(localStorage.getItem('minimal_notes')) || [];
            renderNotes('', true);
        }
        isAppInitialized = true;

        if (supabase) {
            supabase.auth.onAuthStateChange((_e, session) => {
                if (isAppInitialized) handleSession(session, false);
            });
        }
    }

    // ========================================
    // RENDER NOTES
    // ========================================
    function debouncedRender(term = '') {
        clearTimeout(renderTimer);
        // Desactivamos la animacion al teclear en buscar
        renderTimer = setTimeout(() => renderNotes(term, false), 120);
    }

    function setupMarkedRenderer() {
        if (typeof marked === 'undefined') return;
        const renderer = new marked.Renderer();
        renderer.code = function(codeArg, langArg) {
            let code = '', language = 'plaintext';
            if (typeof codeArg === 'object' && codeArg !== null) { code = codeArg.text || ''; language = codeArg.lang || 'plaintext'; }
            else { code = codeArg || ''; language = langArg || 'plaintext'; }
            language = (language || '').split(/\s+/)[0] || 'plaintext';
            let hl;
            try { hl = (typeof hljs !== 'undefined' && hljs.getLanguage(language)) ? hljs.highlight(code, { language }).value : (typeof hljs !== 'undefined' ? hljs.highlightAuto(code).value : esc(code)); }
            catch(_) { hl = esc(code); }
            return `<div class="code-block-wrapper"><div class="code-block-header"><span>${language}</span><button onclick="window.copyCodeFromButton(this)"><i class="fa-regular fa-copy"></i> Copiar</button></div><pre><code class="hljs language-${language}">${hl}</code></pre></div>`;
        };
        marked.setOptions({ breaks: true, gfm: true, renderer });
    }

    function renderNotes(searchTerm = '', animate = true) {
        const term = searchTerm.trim().toLowerCase();
        let filtered = notes;

        if      (activeFilter === 'shared') filtered = notes.filter(n => n.shared);
        else if (activeFilter !== 'all')    filtered = notes.filter(n => n.folder_id === activeFilter);
        else                                filtered = notes.filter(n => !n.folder_id && !n.shared);

        if (term) {
            filtered = filtered.filter(n =>
                (n.title || '').toLowerCase().includes(term) ||
                (n.body  || '').toLowerCase().includes(term) ||
                (n.tags  || []).some(t => t.toLowerCase().includes(term.replace('#','')))
            );
        }

        el.emptyState.classList.toggle('hidden', notes.length > 0 || !!term);
        el.noResults.classList.toggle('hidden', !term || filtered.length > 0);
        el.noteCount.textContent = notes.length;

        filtered.sort((a, b) => {
            if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
            return sortMode === 'alpha'
                ? (a.title || '').localeCompare(b.title || '', 'es')
                : b.updatedAt - a.updatedAt;
        });

        setupMarkedRenderer();

        const frag = document.createDocumentFragment();
        filtered.forEach((note, i) => {
            const card = document.createElement('div');
            card.className = `note-card${note.pinned ? ' pinned' : ''}`;
            card.dataset.id = note.id;
            
            if (animate) {
                card.style.animation = 'cardFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                card.style.setProperty('--animation-order', `${Math.min(i * 0.05, 0.5)}s`);
            } else {
                card.style.animation = 'none'; 
                card.style.opacity = '1'; 
                card.style.transform = 'none';
            }
            
            if (note.color && note.color !== 'default') card.style.backgroundColor = `var(--color-${note.color})`;

            const tags = Array.isArray(note.tags) ? note.tags : [];
            const tagsHtml = tags.length
                ? `<div class="note-tags">${tags.map(t => `<span class="note-tag" onclick="window.searchForTag('${esc(t)}',event)">${esc(t)}</span>`).join('')}</div>` : '';
            const bodyHtml = (typeof marked !== 'undefined' && note.body) ? marked.parse(note.body) : `<p>${esc(note.body || '')}</p>`;

            card.innerHTML = `
                <div class="note-header">
                    <h3 class="note-title">${esc(note.title || 'Sin título')}</h3>
                    <div class="note-icons">${note.pinned ? '<i class="fa-solid fa-thumbtack note-pinned-icon"></i>' : ''}</div>
                </div>
                ${tagsHtml}
                <div class="note-body-preview">${bodyHtml}</div>
                <div class="note-footer">
                    <span>${relativeTime(note.updatedAt)}</span>
                    <div class="card-actions">
                        <button class="card-action-btn dup-card-btn" title="Duplicar"><i class="fa-regular fa-copy"></i></button>
                        <button class="card-action-btn danger delete-card-btn" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
            frag.appendChild(card);
        });

        el.grid.innerHTML = '';
        el.grid.appendChild(frag);
    }

    // ========================================
    // MODAL
    // ========================================
    function openModal(note = null) {
        currentNote = note ? { ...note } : { id: generateId(), title: '', tags: [], body: '', pinned: false, color: 'default', createdAt: Date.now(), updatedAt: Date.now() };

        el.titleInput.value    = currentNote.title || '';
        el.tagsInput.value     = Array.isArray(currentNote.tags) ? currentNote.tags.join(', ') : '';
        el.bodyInput.value     = currentNote.body  || '';
        el.noteFolderSelect.value = currentNote.folder_id || (activeFilter !== 'all' && activeFilter !== 'shared' ? activeFilter : '');
        syncFolderDropdownText();
        el.pinBtn.classList.toggle('active', currentNote.pinned);
        setActiveColorDot(currentNote.color);
        el.saveStatus.classList.remove('visible');
        updateCounts(); updateDateInfo();

        if (note) switchToPreviewMode();
        else      switchToEditMode();

        el.modal.classList.remove('hidden');

        if (currentUser && currentNote.id) joinColabChannel(currentNote.id);

        if (!isPreviewMode) {
            setTimeout(() => {
                if (!currentNote.title) el.titleInput.focus();
                else { el.bodyInput.focus(); el.bodyInput.selectionStart = el.bodyInput.value.length; }
            }, 60);
        }
    }

    function closeModal() {
        if (currentNote && (el.titleInput.value.trim() || el.bodyInput.value.trim())) forceSave();
        else if (currentNote) { notes = notes.filter(n => n.id !== currentNote.id); saveToStorage(); }

        leaveColabChannel();
        el.modal.classList.remove('fullscreen');
        el.modal.classList.add('hidden');
        currentNote = null;
        renderNotes(el.searchInput.value, false);
    }

    // ========================================
    // AUTOSAVE
    // ========================================
    function triggerAutoSave(immediate = false) {
        clearTimeout(autoSaveTimer);
        el.saveStatus.textContent = 'Guardando...';
        el.saveStatus.classList.add('visible');
        if (immediate) { forceSave(); return; }
        autoSaveTimer = setTimeout(forceSave, 800);
    }

    function forceSave() {
        if (!currentNote) return;
        currentNote.title     = el.titleInput.value;
        currentNote.tags      = [...new Set(el.tagsInput.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean))];
        currentNote.body      = el.bodyInput.value;
        currentNote.updatedAt = Date.now();
        currentNote.folder_id = el.noteFolderSelect.value || null;

        const idx = notes.findIndex(n => n.id === currentNote.id);
        if (idx > -1) notes[idx] = { ...currentNote };
        else          notes.push({ ...currentNote });

        saveToStorage();
        if (currentUser) syncNoteToSupabase(currentNote);

        el.saveStatus.textContent = 'Guardado';
        setTimeout(() => { if (el.saveStatus.textContent === 'Guardado') el.saveStatus.classList.remove('visible'); }, 1500);
    }

    // ========================================
    // NOTE ACTIONS
    // ========================================
    function deleteNote(id) {
        const card = el.grid.querySelector(`.note-card[data-id="${id}"]`);
        if (!card) return;
        card.classList.add('removing');
        setTimeout(() => {
            const idx = notes.findIndex(n => n.id === id);
            if (idx > -1) {
                deletedNote = notes[idx]; notes.splice(idx, 1);
                saveToStorage(); if (currentUser) deleteNoteFromSupabase(id);
                renderNotes(el.searchInput.value, false); showToast('Nota eliminada');
            }
        }, 250);
    }

    function duplicateNote(id) {
        const orig = notes.find(n => n.id === id); if (!orig) return;
        const dup = { id: generateId(), title: (orig.title || '') + ' (copia)', tags: [...(orig.tags || [])], body: orig.body, pinned: false, color: orig.color, createdAt: Date.now(), updatedAt: Date.now() };
        notes.push(dup);
        saveToStorage(); 
        if(currentUser) syncNoteToSupabase(dup);
        renderNotes(el.searchInput.value, true); showToast('Nota duplicada');
    }

    function exportNotes() {
        if (!notes.length) { showToast('No hay notas'); return; }
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' })), download: `notas_${new Date().toISOString().slice(0,10)}.json` });
        a.click(); showToast('Notas exportadas'); el.dropdownMenu.classList.add('hidden');
    }

    function importNotes(e) {
        const file = e.target.files[0]; 
        if (!file) return;
        const fr = new FileReader(); 
        fr.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result); 
                if (!Array.isArray(imported)) throw new Error();
                let count = 0;
                imported.forEach(n => { 
                    if (n.id && !notes.find(x => x.id === n.id)) { 
                        const newNote = { id: n.id, title: n.title||'', tags: Array.isArray(n.tags)?n.tags:[], body: n.body||'', pinned:!!n.pinned, color: n.color||'default', createdAt: n.createdAt||Date.now(), updatedAt: n.updatedAt||Date.now() };
                        notes.push(newNote); 
                        if(currentUser) syncNoteToSupabase(newNote); // Sincroniza en nube si importamos
                        count++; 
                    } 
                });
                saveToStorage(); renderNotes('', true); showToast(`${count} nota(s) importada(s)`);
            } catch(_) { 
                showToast('Archivo no válido'); 
            }
        };
        fr.readAsText(file); 
        el.importFile.value = ''; 
        el.dropdownMenu.classList.add('hidden');
    }

    function setSortMode(mode) {
        sortMode = mode; localStorage.setItem('minimal_sort', mode);
        el.sortDateBtn.classList.toggle('active', mode === 'date');
        el.sortAlphaBtn.classList.toggle('active', mode === 'alpha');
        renderNotes(el.searchInput.value, true); el.dropdownMenu.classList.add('hidden');
    }

    // ========================================
    // THEME & HELPERS
    // ========================================
    function toggleTheme() {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('minimal_theme', next);
        updateThemeIcon(next);
        const link = document.getElementById('hljs-theme');
        if (link) link.href = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/atom-one-${next}.min.css`;
    }

    function updateCounts() {
        const body = el.bodyInput.value;
        const words = body.trim() ? body.trim().split(/\s+/).length : 0;
        el.wordCount.textContent = `${words} palabra${words !== 1 ? 's' : ''}`;
        el.charCount.textContent = `${body.length} car.`;
    }

    function updateDateInfo() {
        if (!currentNote) return;
        el.dateInfo.textContent = `Creada: ${new Date(currentNote.createdAt).toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}`;
    }

    function setActiveColorDot(color) { el.colorDots.forEach(d => d.classList.toggle('active', d.dataset.color === color)); }

    function updateThemeIcon(theme) { el.themeToggle.querySelector('i').className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'; }

    function showToast(message) {
        clearTimeout(toastTimer);
        el.toastMessage.textContent = message;
        el.toast.classList.remove('hidden'); void el.toast.offsetWidth; el.toast.classList.add('visible');
        toastTimer = setTimeout(hideToast, 4000);
    }

    function hideToast() {
        el.toast.classList.remove('visible');
        setTimeout(() => { if (!el.toast.classList.contains('visible')) { el.toast.classList.add('hidden'); deletedNote = null; } }, 300);
    }

    function relativeTime(ts) {
        const d = Date.now() - ts, s = Math.floor(d/1000), m = Math.floor(s/60), h = Math.floor(m/60), dy = Math.floor(h/24);
        if (s < 60)  return 'Ahora';
        if (m < 60)  return `Hace ${m} min`;
        if (h < 24)  return `Hace ${h}h`;
        if (dy < 7)  return `Hace ${dy}d`;
        return new Date(ts).toLocaleDateString('es-ES', { day:'numeric', month:'short' });
    }

    function esc(str) {
        if (!str) return '';
        const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
    }

    function generateId() {
        return crypto.randomUUID?.() || `n_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    }

    async function generateAIContent(prompt) {
        try {
            const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            if (data.text) {
                let r = data.text.trim();
                if (r.startsWith('```markdown')) r = r.slice(11).trim();
                else if (r.startsWith('```')) r = r.slice(3).trim();
                if (r.endsWith('```')) r = r.slice(0,-3).trim();
                return r;
            }
            throw new Error('No content');
        } catch(e) { console.error('AI:', e); return null; }
    }

    // ========================================
    // STARTUP
    // ========================================
    el.sortDateBtn.classList.toggle('active', sortMode === 'date');
    el.sortAlphaBtn.classList.toggle('active', sortMode === 'alpha');

    window.copyCodeFromButton = function(btn) {
        const code = btn.closest('.code-block-wrapper').querySelector('pre code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            const orig = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado';
            setTimeout(() => { btn.innerHTML = orig; }, 2000);
        }).catch(() => {});
    };

    window.searchForTag = function(tag, e) {
        if (e) e.stopPropagation();
        el.searchInput.value = tag;
        el.searchInput.dispatchEvent(new Event('input'));
        el.searchInput.focus();
    };

    window.closeModalFromGlobal = function() { document.getElementById('close-modal-btn')?.click(); };

    // Disparamos la carga segura para evitar el parpadeo
    initApp();
});