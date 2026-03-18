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

        // Folders & Sidebar
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
    // LOGIC & SUPABASE INIT
    // ========================================
    const SUPABASE_URL = 'https://csbrquxujvcofgjkqnwb.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_prYpU6J1bAfh5nq7JsXZxA_dERwPrLy';
    const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
    let currentUser = null;

    let notes = JSON.parse(localStorage.getItem('minimal_notes')) || [];
    let folders = JSON.parse(localStorage.getItem('minimal_folders')) || [];
    let currentNote = null;
    let deletedNote = null;
    let autoSaveTimer = null;
    let toastTimer = null;
    let sortMode = localStorage.getItem('minimal_sort') || 'date';
    let activeFilter = 'all';
    let currentShareFolderId = null;
    let realtimeChannel = null;

    // ========================================
    // COLLABORATIVE EDITING STATE
    // ========================================
    let colabChannel = null;          // Supabase Broadcast channel for the open note
    let colabPresenceChannel = null;  // Presence channel for the open note
    let isReceivingRemote = false;    // Guard to avoid echo loops
    let collaborators = {};           // { userId: { name, avatar, color } }
    let remoteCaretColors = {};       // color assigned per remote user
    const COLAB_COLORS = [
        '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#a855f7',
        '#ec4899', '#06b6d4', '#84cc16'
    ];

    // Create the collaborator avatars bar in the modal header (injected once)
    const colabBar = document.createElement('div');
    colabBar.id = 'colab-bar';
    colabBar.style.cssText = `
        display: flex; align-items: center; gap: 6px;
        margin-right: 8px; transition: opacity 0.3s;
    `;
    // Insert before save-status in modal-actions-right
    const saveStatusEl = el.saveStatus;
    saveStatusEl.parentNode.insertBefore(colabBar, saveStatusEl);

    // Live typing indicator label
    const typingLabel = document.createElement('span');
    typingLabel.id = 'typing-label';
    typingLabel.style.cssText = `
        font-size: 0.68rem; color: var(--text-muted); font-weight: 500;
        opacity: 0; transition: opacity 0.3s; white-space: nowrap;
        margin-right: 6px;
    `;
    saveStatusEl.parentNode.insertBefore(typingLabel, colabBar);

    // Remote cursor overlay for the textarea
    const remoteCursorOverlay = document.createElement('div');
    remoteCursorOverlay.id = 'remote-cursor-overlay';
    remoteCursorOverlay.style.cssText = `
        position: absolute; pointer-events: none;
        top: 0; left: 0; right: 0; bottom: 0; overflow: hidden;
        z-index: 2;
    `;
    // Wrap textarea in a relative container
    el.bodyInput.parentNode.style.position = 'relative';
    el.bodyInput.parentNode.appendChild(remoteCursorOverlay);

    // ========================================
    // COLAB: JOIN / LEAVE CHANNEL
    // ========================================
    function joinColabChannel(noteId) {
        leaveColabChannel();
        if (!supabase || !currentUser || !noteId) return;

        const channelName = `note-colab-${noteId}`;
        collaborators = {};
        remoteCaretColors = {};
        updateColabBar();

        colabChannel = supabase.channel(channelName, {
            config: { broadcast: { self: false } }
        });

        // Listen for content changes from others
        colabChannel.on('broadcast', { event: 'content' }, ({ payload }) => {
            if (!payload || payload.userId === currentUser?.id) return;
            isReceivingRemote = true;

            // Update title
            if (payload.title !== undefined && el.titleInput.value !== payload.title) {
                const titlePos = el.titleInput.selectionStart;
                el.titleInput.value = payload.title;
                try { el.titleInput.setSelectionRange(titlePos, titlePos); } catch(e) {}
            }

            // Update body - preserve local cursor position
            if (payload.body !== undefined && el.bodyInput.value !== payload.body) {
                const bodyPos = el.bodyInput.selectionStart;
                el.bodyInput.value = payload.body;
                try { el.bodyInput.setSelectionRange(bodyPos, bodyPos); } catch(e) {}
                updateCounts();
            }

            // Show remote caret position
            if (payload.caretPos !== undefined && payload.userId) {
                showRemoteCaret(payload.userId, payload.caretPos, payload.color);
            }

            isReceivingRemote = false;

            // Pulse the typing indicator
            const name = collaborators[payload.userId]?.name || 'Alguien';
            showTypingLabel(`${name} está escribiendo...`);

            // Sync to currentNote without re-saving
            if (currentNote) {
                currentNote.title = el.titleInput.value;
                currentNote.body = el.bodyInput.value;
            }
        });

        // Presence: track who's in the note
        colabChannel.on('presence', { event: 'sync' }, () => {
            const state = colabChannel.presenceState();
            const newCollaborators = {};
            let colorIdx = 0;

            Object.values(state).forEach(presences => {
                presences.forEach(p => {
                    if (p.userId === currentUser?.id) return;
                    const existingColor = remoteCaretColors[p.userId] || COLAB_COLORS[colorIdx % COLAB_COLORS.length];
                    colorIdx++;
                    remoteCaretColors[p.userId] = existingColor;
                    newCollaborators[p.userId] = {
                        name: p.name || 'Anónimo',
                        avatar: p.avatar || null,
                        color: existingColor
                    };
                });
            });

            collaborators = newCollaborators;
            updateColabBar();
        });

        colabChannel.on('presence', { event: 'join' }, ({ newPresences }) => {
            newPresences.forEach(p => {
                if (p.userId === currentUser?.id) return;
                const color = remoteCaretColors[p.userId] || COLAB_COLORS[Object.keys(remoteCaretColors).length % COLAB_COLORS.length];
                remoteCaretColors[p.userId] = color;
                collaborators[p.userId] = {
                    name: p.name || 'Anónimo',
                    avatar: p.avatar || null,
                    color
                };
                updateColabBar();
                showTypingLabel(`${p.name || 'Alguien'} se unió`);
            });
        });

        colabChannel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
            leftPresences.forEach(p => {
                if (p.userId === currentUser?.id) return;
                delete collaborators[p.userId];
                delete remoteCaretColors[p.userId];
                removeRemoteCaret(p.userId);
                updateColabBar();
            });
        });

        colabChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED' && currentUser) {
                await colabChannel.track({
                    userId: currentUser.id,
                    name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Tú',
                    avatar: currentUser.user_metadata?.avatar_url || null,
                    noteId
                });
            }
        });
    }

    function leaveColabChannel() {
        if (colabChannel) {
            supabase?.removeChannel(colabChannel);
            colabChannel = null;
        }
        collaborators = {};
        remoteCaretColors = {};
        remoteCursorOverlay.innerHTML = '';
        updateColabBar();
        typingLabel.style.opacity = '0';
    }

    // ========================================
    // COLAB: BROADCAST CONTENT CHANGES
    // ========================================
    let broadcastTimer = null;

    function broadcastContent() {
        if (!colabChannel || !currentUser || isReceivingRemote) return;

        // Throttle to ~60ms for smooth real-time feel
        if (broadcastTimer) clearTimeout(broadcastTimer);
        broadcastTimer = setTimeout(() => {
            const caretPos = el.bodyInput.selectionStart;
            colabChannel.send({
                type: 'broadcast',
                event: 'content',
                payload: {
                    userId: currentUser.id,
                    title: el.titleInput.value,
                    body: el.bodyInput.value,
                    caretPos,
                    color: remoteCaretColors[currentUser.id] || COLAB_COLORS[0]
                }
            });
        }, 60);
    }

    // ========================================
    // COLAB: REMOTE CARET VISUALIZATION
    // ========================================
    const remoteCaretEls = {}; // { userId: domElement }

    function showRemoteCaret(userId, caretPos, color) {
        if (!el.bodyInput || isPreviewMode) return;

        const coords = getCaretCoordinates(el.bodyInput, caretPos);
        if (!coords) return;

        let caretEl = remoteCaretEls[userId];
        if (!caretEl) {
            caretEl = document.createElement('div');
            caretEl.style.cssText = `
                position: absolute; width: 2px; border-radius: 2px;
                pointer-events: none; transition: top 0.1s, left 0.1s;
                z-index: 3;
            `;
            const label = document.createElement('span');
            label.style.cssText = `
                position: absolute; top: -18px; left: 0;
                background: ${color}; color: white;
                font-size: 10px; font-weight: 600;
                padding: 1px 5px; border-radius: 4px;
                white-space: nowrap; pointer-events: none;
                font-family: inherit;
            `;
            label.textContent = collaborators[userId]?.name?.split(' ')[0] || '?';
            caretEl.appendChild(label);
            remoteCursorOverlay.appendChild(caretEl);
            remoteCaretEls[userId] = caretEl;
        }

        const c = color || '#f59e0b';
        caretEl.style.background = c;
        caretEl.style.height = `${coords.height}px`;

        // Offset by textarea scroll and position
        const textareaRect = el.bodyInput.getBoundingClientRect();
        const overlayRect = remoteCursorOverlay.getBoundingClientRect();

        const relTop = coords.top - el.bodyInput.scrollTop;
        const relLeft = coords.left;

        caretEl.style.top = `${relTop}px`;
        caretEl.style.left = `${relLeft}px`;
        caretEl.style.opacity = '1';

        // Fade out after 3s of no updates
        clearTimeout(caretEl._fadeTimer);
        caretEl._fadeTimer = setTimeout(() => {
            caretEl.style.opacity = '0';
        }, 3000);
    }

    function removeRemoteCaret(userId) {
        const el = remoteCaretEls[userId];
        if (el) {
            el.remove();
            delete remoteCaretEls[userId];
        }
    }

    // Get pixel coordinates of caret in a textarea
    function getCaretCoordinates(textarea, position) {
        try {
            const div = document.createElement('div');
            const style = getComputedStyle(textarea);
            ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing',
             'padding','paddingTop','paddingBottom','paddingLeft','paddingRight',
             'border','borderTop','borderBottom','borderLeft','borderRight',
             'width','boxSizing','whiteSpace','wordWrap','overflowWrap'
            ].forEach(p => { div.style[p] = style[p]; });

            div.style.position = 'absolute';
            div.style.visibility = 'hidden';
            div.style.whiteSpace = 'pre-wrap';
            div.style.wordWrap = 'break-word';
            div.style.overflow = 'hidden';
            div.style.height = style.height;

            const textBefore = textarea.value.substring(0, position);
            div.textContent = textBefore;

            const span = document.createElement('span');
            span.textContent = '|';
            div.appendChild(span);

            document.body.appendChild(div);
            const spanRect = span.getBoundingClientRect();
            const divRect = div.getBoundingClientRect();
            document.body.removeChild(div);

            return {
                top: spanRect.top - divRect.top + textarea.offsetTop,
                left: spanRect.left - divRect.left + textarea.offsetLeft,
                height: spanRect.height
            };
        } catch (e) {
            return null;
        }
    }

    // ========================================
    // COLAB: UI HELPERS
    // ========================================
    function updateColabBar() {
        colabBar.innerHTML = '';
        const count = Object.keys(collaborators).length;
        if (count === 0) {
            colabBar.style.opacity = '0';
            return;
        }
        colabBar.style.opacity = '1';

        Object.entries(collaborators).forEach(([uid, info]) => {
            const avatar = document.createElement('div');
            avatar.title = info.name;
            avatar.style.cssText = `
                width: 26px; height: 26px; border-radius: 50%;
                border: 2px solid ${info.color};
                overflow: hidden; flex-shrink: 0;
                display: flex; align-items: center; justify-content: center;
                background: ${info.color}22; font-size: 11px; font-weight: 700;
                color: ${info.color}; cursor: default;
                transition: transform 0.2s;
            `;
            avatar.onmouseenter = () => avatar.style.transform = 'scale(1.15)';
            avatar.onmouseleave = () => avatar.style.transform = 'scale(1)';

            if (info.avatar) {
                const img = document.createElement('img');
                img.src = info.avatar;
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                img.onerror = () => { avatar.textContent = info.name?.[0]?.toUpperCase() || '?'; };
                avatar.appendChild(img);
            } else {
                avatar.textContent = info.name?.[0]?.toUpperCase() || '?';
            }
            colabBar.appendChild(avatar);
        });

        // Pulse animation for new collaborators
        const style = document.getElementById('colab-pulse-style') || (() => {
            const s = document.createElement('style');
            s.id = 'colab-pulse-style';
            s.textContent = `
                @keyframes colabPulse {
                    0% { box-shadow: 0 0 0 0 rgba(245,158,11,0.5); }
                    70% { box-shadow: 0 0 0 8px rgba(245,158,11,0); }
                    100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
                }
                #colab-bar > div { animation: colabPulse 1s ease-out; }
                #typing-label { font-style: italic; }
            `;
            document.head.appendChild(s);
            return s;
        })();
    }

    let typingTimer = null;
    function showTypingLabel(text) {
        typingLabel.textContent = text;
        typingLabel.style.opacity = '1';
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            typingLabel.style.opacity = '0';
        }, 2500);
    }

    // Init theme
    const savedTheme = localStorage.getItem('minimal_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Initial render from local
    renderNotes();

    // Check auth session
    if (supabase) {
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleSession(session);
        });

        supabase.auth.onAuthStateChange((_event, session) => {
            handleSession(session);
        });
    }

    // ========================================
    // EVENT LISTENERS
    // ========================================

    // --- Header & Sidebar ---
    el.addBtn.addEventListener('click', () => openModal());
    if (el.addAiBtn) {
        el.addAiBtn.addEventListener('click', () => {
            el.aiTopicInput.value = '';
            el.aiModal.classList.remove('hidden');
            setTimeout(() => el.aiTopicInput.focus(), 50);
        });
    }

    if (el.closeAiModalBtn) {
        el.closeAiModalBtn.addEventListener('click', () => el.aiModal.classList.add('hidden'));
        el.cancelAiBtn.addEventListener('click', () => el.aiModal.classList.add('hidden'));
        
        el.saveAiBtn.addEventListener('click', async () => {
            const topic = el.aiTopicInput.value.trim();
            if (!topic) return;

            el.saveAiBtn.disabled = true;
            el.saveAiBtn.innerHTML = 'Generando... <i class="fa-solid fa-spinner fa-spin"></i>';
            showToast('Generando nota...');

            const aiContent = await generateAIContent(`Crea una nota clara y estructurada sobre: ${topic}. Responde ÚNICAMENTE con el contenido solicitado. No incluyas saludos, presentaciones, ni bloques de código markdown (\`\`\`). Usa formato markdown para la estructura interna, pero NO incluyas un título grande de primer nivel al inicio.`);

            if (aiContent) {
                const newNote = {
                    id: generateId(),
                    title: topic.charAt(0).toUpperCase() + topic.slice(1),
                    tags: ['IA'],
                    body: aiContent,
                    pinned: false,
                    color: 'default',
                    folder_id: activeFilter !== 'all' && activeFilter !== 'shared' ? activeFilter : null,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                notes.push(newNote);
                saveToStorage();
                if (currentUser) syncNoteToSupabase(newNote);
                renderNotes(el.searchInput.value);
                hideToast();
                
                el.aiModal.classList.add('hidden');
                openModal(newNote);
            } else {
                showToast('Error al generar la nota');
            }
            
            el.saveAiBtn.disabled = false;
            el.saveAiBtn.innerHTML = 'Generar <i class="fa-solid fa-wand-magic-sparkles"></i>';
        });
    }
    el.themeToggle.addEventListener('click', toggleTheme);

    el.mobileMenuBtn?.addEventListener('click', () => {
        el.sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && el.sidebar.classList.contains('open')) {
            if (!el.sidebar.contains(e.target) && !el.mobileMenuBtn.contains(e.target)) {
                el.sidebar.classList.remove('open');
            }
        }
    });

    el.navAllNotes.addEventListener('click', () => {
        activeFilter = 'all';
        el.header.querySelector('#header-title').textContent = 'Todas mis notas';
        updateSidebarActive(el.navAllNotes);
        renderNotes(el.searchInput.value);
    });

    el.navSharedNotes?.addEventListener('click', () => {
        activeFilter = 'shared';
        el.header.querySelector('#header-title').textContent = 'Compartidas conmigo';
        updateSidebarActive(el.navSharedNotes);
        renderNotes(el.searchInput.value);
    });

    // --- Folder Modals ---
    el.addFolderBtn.addEventListener('click', () => {
        el.folderNameInput.value = '';
        el.folderModal.classList.remove('hidden');
        setTimeout(() => el.folderNameInput.focus(), 50);
    });

    el.closeFolderModalBtn.addEventListener('click', () => el.folderModal.classList.add('hidden'));
    el.cancelFolderBtn.addEventListener('click', () => el.folderModal.classList.add('hidden'));
    
    el.saveFolderBtn.addEventListener('click', createFolder);
    el.folderNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') createFolder();
        if (e.key === 'Escape') el.folderModal.classList.add('hidden');
    });

    // Share Modals basics
    el.closeShareModalBtn?.addEventListener('click', () => el.shareModal.classList.add('hidden'));
    el.cancelShareBtn?.addEventListener('click', () => el.shareModal.classList.add('hidden'));
    el.saveShareBtn?.addEventListener('click', shareFolder);

    // --- Scroll Header ---
    window.addEventListener('scroll', () => {
        el.header.classList.toggle('scrolled', window.scrollY > 10);
    });

    // --- Search ---
    el.searchInput.addEventListener('input', (e) => {
        el.clearSearch.classList.toggle('hidden', !e.target.value);
        renderNotes(e.target.value);
    });
    el.clearSearch.addEventListener('click', () => {
        el.searchInput.value = '';
        el.clearSearch.classList.add('hidden');
        renderNotes();
        el.searchInput.focus();
    });

    // --- Dropdown Menu ---
    el.menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        el.dropdownMenu.classList.toggle('hidden');
    });
    
    // --- Folder Dropdown ---
    if (el.folderDropdownBtn) {
        el.folderDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            el.folderDropdownMenu.classList.toggle('hidden');
        });
    }

    document.addEventListener('click', () => {
        el.dropdownMenu.classList.add('hidden');
        if (el.folderDropdownMenu) el.folderDropdownMenu.classList.add('hidden');
    });

    el.exportBtn.addEventListener('click', exportNotes);
    el.importBtn.addEventListener('click', () => el.importFile.click());
    el.importFile.addEventListener('change', importNotes);

    el.sortDateBtn.addEventListener('click', () => setSortMode('date'));
    el.sortAlphaBtn.addEventListener('click', () => setSortMode('alpha'));

    // --- Auth interactions ---
    if (el.loginGoogleBtn) {
        el.loginGoogleBtn.addEventListener('click', async () => {
            if (!supabase) return;
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                    queryParams: { access_type: 'offline', prompt: 'consent' }
                }
            });
            if (error) console.error("Error logging in:", error.message);
        });
    }

    // --- User Profile Dropdown ---
    if (el.userProfile) {
        el.userProfile.addEventListener('click', (e) => {
            e.stopPropagation();
            el.userDropdownMenu.classList.toggle('show');
        });
    }
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#user-profile-container')) {
            el.userDropdownMenu?.classList.remove('show');
        }
    });

    if (el.logoutBtn) {
        el.logoutBtn.addEventListener('click', async () => {
            if (!supabase) return;
            leaveColabChannel();
            if (realtimeChannel) {
                supabase.removeChannel(realtimeChannel);
                realtimeChannel = null;
            }
            await supabase.auth.signOut();
            notes = [];
            el.userDropdownMenu.classList.remove('show');
            saveToStorage();
            renderNotes();
        });
    }

    // --- Grid interactions ---
    el.grid.addEventListener('click', (e) => {
        const card = e.target.closest('.note-card');
        const deleteBtn = e.target.closest('.delete-card-btn');
        const dupBtn = e.target.closest('.dup-card-btn');

        if (deleteBtn && card) { e.stopPropagation(); deleteNote(card.dataset.id); return; }
        if (dupBtn && card) { e.stopPropagation(); duplicateNote(card.dataset.id); return; }
        if (card) {
            const note = notes.find(n => n.id === card.dataset.id);
            if (note) openModal(note);
        }
    });

    // --- Modal ---
    el.closeModalBtn.addEventListener('click', closeModal);
    el.modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) closeModal();
    });

    el.titleInput.addEventListener('input', () => {
        updateCounts();
        triggerAutoSave();
        broadcastContent(); // 🔴 BROADCAST
    });
    el.bodyInput.addEventListener('input', () => {
        updateCounts();
        triggerAutoSave();
        broadcastContent(); // 🔴 BROADCAST
    });

    // Also broadcast on cursor movement (so others see caret moving)
    el.bodyInput.addEventListener('keyup', broadcastContent);
    el.bodyInput.addEventListener('click', broadcastContent);
    el.bodyInput.addEventListener('selectionchange', broadcastContent);

    // Tab support in textarea
    el.bodyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = el.bodyInput.selectionStart;
            const end = el.bodyInput.selectionEnd;
            const value = el.bodyInput.value;
            el.bodyInput.value = value.substring(0, start) + '    ' + value.substring(end);
            el.bodyInput.selectionStart = el.bodyInput.selectionEnd = start + 4;
            triggerAutoSave();
            broadcastContent();
        }
    });

    el.pinBtn.addEventListener('click', () => {
        if (!currentNote) return;
        currentNote.pinned = !currentNote.pinned;
        el.pinBtn.classList.toggle('active', currentNote.pinned);
        triggerAutoSave(true);
    });

    el.duplicateBtn.addEventListener('click', () => {
        if (!currentNote) return;
        const dup = {
            id: generateId(),
            title: currentNote.title ? currentNote.title + ' (copia)' : '',
            tags: currentNote.tags ? [...currentNote.tags] : [],
            body: el.bodyInput.value,
            pinned: false,
            color: currentNote.color,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        notes.push(dup);
        saveToStorage();
        showToast('Nota duplicada');
    });

    let isPreviewMode = false;
    el.togglePreviewBtn.addEventListener('click', () => {
        isPreviewMode = !isPreviewMode;
        el.bodyInput.classList.toggle('hidden', isPreviewMode);
        el.previewBody.classList.toggle('hidden', !isPreviewMode);
        el.toolbar.classList.toggle('hidden', isPreviewMode);
        remoteCursorOverlay.style.display = isPreviewMode ? 'none' : 'block';
        
        const icon = el.togglePreviewBtn.querySelector('i');
        if (isPreviewMode) {
            icon.className = 'fa-solid fa-pen';
            
            const rawMarkdown = el.bodyInput.value || '*Nada que previsualizar*';
            let markdown = typeof marked !== 'undefined' ? marked.parse(rawMarkdown) : '<p>Error cargando preview</p>';
            
            markdown = markdown.replace(/<input disabled="" type="checkbox"/g, '<input type="checkbox" class="interactive-checkbox"');
            markdown = markdown.replace(/<input type="checkbox" disabled=""/g, '<input type="checkbox" class="interactive-checkbox"');

            el.previewBody.innerHTML = markdown;
            
            setTimeout(() => {
                const checkboxes = el.previewBody.querySelectorAll('.interactive-checkbox');
                checkboxes.forEach((cb, index) => {
                    cb.addEventListener('change', (e) => {
                        toggleMarkdownCheckbox(index, e.target.checked);
                    });
                });
            }, 10);
            
        } else {
            icon.className = 'fa-solid fa-eye';
            el.bodyInput.focus();
        }
    });

    function toggleMarkdownCheckbox(checkboxIndex, isChecked) {
        if (!currentNote) return;
        const bodyContent = el.bodyInput.value;
        
        let matchIndex = 0;
        const newBody = bodyContent.replace(/- \[[ xX]\]/g, (match) => {
            if (matchIndex === checkboxIndex) {
                matchIndex++;
                return isChecked ? '- [x]' : '- [ ]';
            }
            matchIndex++;
            return match;
        });

        el.bodyInput.value = newBody;
        currentNote.body = newBody;
        triggerAutoSave(true);
        broadcastContent();
    }

    if (el.fullscreenBtn) {
        el.fullscreenBtn.addEventListener('click', () => {
            el.modal.classList.toggle('fullscreen');
            const icon = el.fullscreenBtn.querySelector('i');
            icon.className = el.modal.classList.contains('fullscreen') ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
        });
    }

    // Toolbar actions
    el.toolbarBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const start = el.bodyInput.selectionStart;
            const end = el.bodyInput.selectionEnd;
            const text = el.bodyInput.value;
            const selected = text.substring(start, end);
            let insertion = '';
            let newCursorPos = start;

            if (action === 'bold') {
                insertion = `**${selected}**`;
                newCursorPos = selected ? start + insertion.length : start + 2;
            } else if (action === 'italic') {
                insertion = `*${selected}*`;
                newCursorPos = selected ? start + insertion.length : start + 1;
            } else if (action === 'strikethrough') {
                insertion = `~~${selected}~~`;
                newCursorPos = selected ? start + insertion.length : start + 2;
            } else if (action === 'list') {
                insertion = `\n- ${selected || 'ítem'}`;
                newCursorPos = start + insertion.length;
            } else if (action === 'checklist') {
                insertion = `\n- [ ] ${selected || 'tarea'}`;
                newCursorPos = start + insertion.length;
            } else if (action === 'code') {
                insertion = `\n\`\`\`\n${selected || 'código'}\n\`\`\`\n`;
                newCursorPos = start + insertion.length;
            }

            el.bodyInput.value = text.substring(0, start) + insertion + text.substring(end);
            el.bodyInput.focus();
            el.bodyInput.selectionStart = el.bodyInput.selectionEnd = newCursorPos;
            triggerAutoSave();
            broadcastContent();
        });
    });

    // AI Actions
    if (el.aiBtns) {
        el.aiBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!currentNote) return;
                const action = btn.dataset.action;
                const start = el.bodyInput.selectionStart;
                const end = el.bodyInput.selectionEnd;
                const fullText = el.bodyInput.value;
                const selectedText = fullText.substring(start, end);
                
                const textToProcess = selectedText || fullText;
                
                if (!textToProcess.trim()) {
                    showToast('Escribe algo primero');
                    return;
                }

                showToast('Procesando con IA...');
                
                let prompt = '';
                const baseInstructions = "Responde ÚNICAMENTE con el contenido solicitado. No incluyas saludos, explicaciones extras, ni bloques de código envolventes tipo ```markdown o ```.";
                if (action === 'ai-order') {
                    prompt = `Organiza el siguiente texto en una lista de puntos clave clara y estructurada, descartando relleno innecesario. ${baseInstructions}:\n\n${textToProcess}`;
                } else if (action === 'ai-summarize') {
                    prompt = `Resume el siguiente texto de la forma más concisa y minimalista posible, conservando la idea principal. ${baseInstructions}:\n\n${textToProcess}`;
                } else if (action === 'ai-extend') {
                    prompt = `Extiende y desarrolla detalladamente la siguiente idea o texto, añadiendo contexto, ejemplos o explicaciones relevantes. ${baseInstructions}:\n\n${textToProcess}`;
                }

                const result = await generateAIContent(prompt);

                if (result) {
                    if (selectedText) {
                        el.bodyInput.value = fullText.substring(0, start) + result + fullText.substring(end);
                    } else {
                        el.bodyInput.value = result;
                    }
                    triggerAutoSave();
                    updateCounts();
                    broadcastContent();
                    hideToast();
                } else {
                    showToast('Error con la IA');
                }
            });
        });
    }

    el.downloadNoteBtn.addEventListener('click', () => {
        if (!currentNote) return;
        const content = `${el.titleInput.value ? '# ' + el.titleInput.value + '\\n\\n' : ''}${el.bodyInput.value}`;
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(el.titleInput.value || 'nota_sin_titulo').toLowerCase().replace(/\\s+/g, '_')}.md`;
        a.click();
        URL.revokeObjectURL(url);
    });

    el.colorDots.forEach(dot => {
        dot.addEventListener('click', () => {
            if (!currentNote) return;
            currentNote.color = dot.dataset.color;
            setActiveColorDot(dot.dataset.color);
            triggerAutoSave(true);
        });
    });

    // --- Undo ---
    el.undoBtn.addEventListener('click', () => {
        if (deletedNote) {
            notes.push(deletedNote);
            saveToStorage();
            if (currentUser && typeof syncNoteToSupabase === 'function') {
                syncNoteToSupabase(deletedNote);
            }
            deletedNote = null;
            renderNotes(el.searchInput.value);
            hideToast();
        }
    });

    // ========================================
    // CORE FUNCTIONS
    // ========================================

    function saveToStorage() {
        if (currentUser && supabase) {
            localStorage.setItem(`minimal_notes_${currentUser.id}`, JSON.stringify(notes));
        } else {
            localStorage.setItem('minimal_notes', JSON.stringify(notes));
        }
    }

    async function syncNoteToSupabase(note) {
        if (!currentUser || !supabase) return;
        
        try {
            const { error } = await supabase
                .from('notes')
                .upsert({
                    id: note.id,
                    user_id: note.user_id || currentUser.id,
                    folder_id: note.folder_id,
                    title: note.title,
                    tags: note.tags,
                    body: note.body,
                    pinned: note.pinned,
                    color: note.color,
                    created_at: new Date(note.createdAt).toISOString(),
                    updated_at: new Date(note.updatedAt).toISOString()
                }, { onConflict: 'id' });
                
            if (error) console.error('Error saving to Supabase:', error);
        } catch (err) {
            console.error('Network error saving to Supabase:', err);
        }
    }
    
    async function deleteNoteFromSupabase(noteId) {
        if (!currentUser || !supabase) return;
        
        try {
            const { error } = await supabase
                .from('notes')
                .delete()
                .eq('id', noteId)
                .eq('user_id', currentUser.id);
                
            if (error) console.error('Error deleting from Supabase:', error);
        } catch (err) {
            console.error('Network error deleting from Supabase:', err);
        }
    }

    async function loadNotesFromSupabase() {
        if (!currentUser || !supabase) return;
        
        try {
            const { data, error } = await supabase
                .from('notes')
                .select('*');
                
            if (error) {
                console.error('Error fetching from Supabase:', error);
                showToast('Error cargando notas de la nube');
                return;
            }
            
            if (data && data.length > 0) {
                notes = data.map(n => ({
                    id: n.id,
                    title: n.title,
                    tags: n.tags || [],
                    body: n.body,
                    pinned: n.pinned,
                    color: n.color,
                    folder_id: n.folder_id,
                    user_id: n.user_id,
                    shared: n.user_id !== currentUser.id,
                    createdAt: new Date(n.created_at).getTime(),
                    updatedAt: new Date(n.updated_at).getTime()
                }));
                saveToStorage();
                renderNotes();
            }
        } catch (err) {
            console.error('Network error fetching from Supabase:', err);
        }
    }

    async function loadFoldersFromSupabase() {
        if (!currentUser || !supabase) return;
        
        try {
            const { data: myFolders, error: myError } = await supabase
                .from('folders')
                .select('*')
                .order('name');
                
            if (myError) console.error('Error fetching folders:', myError);
            else folders = myFolders || [];

            saveFoldersToStorage();
            renderFoldersSidebar();
            updateFolderSelects();
        } catch (err) {
            console.error('Network error fetching folders:', err);
        }
    }

    function saveFoldersToStorage() {
        localStorage.setItem('minimal_folders', JSON.stringify(folders));
    }

    async function createFolder() {
        const name = el.folderNameInput.value.trim();
        if (!name || !currentUser || !supabase) return;

        el.saveFolderBtn.disabled = true;
        el.saveFolderBtn.textContent = 'Creando...';

        try {
            const { data, error } = await supabase
                .from('folders')
                .insert([{ user_id: currentUser.id, name }])
                .select()
                .single();

            if (error) {
                console.error('Error creating folder:', error);
                showToast('Error al crear carpeta');
            } else if (data) {
                folders.push(data);
                folders.sort((a, b) => a.name.localeCompare(b.name));
                saveFoldersToStorage();
                renderFoldersSidebar();
                updateFolderSelects();
                showToast('Carpeta creada');
                el.folderModal.classList.add('hidden');
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            el.saveFolderBtn.disabled = false;
            el.saveFolderBtn.textContent = 'Crear';
        }
    }

    function renderFoldersSidebar() {
        el.folderList.innerHTML = '';
        if (!currentUser) return;

        folders.forEach(folder => {
            const isOwner = folder.user_id === currentUser.id;
            const li = document.createElement('li');
            li.className = `folder-item ${activeFilter === folder.id ? 'active' : ''}`;
            li.dataset.id = folder.id;
            
            let actionsHtml = '';
            if (isOwner) {
                actionsHtml = `
                <div class="folder-actions">
                    <button class="icon-btn small share-folder-btn" title="Compartir" aria-label="Compartir">
                        <i class="fa-solid fa-user-plus"></i>
                    </button>
                    <button class="icon-btn small delete-folder-btn text-danger" title="Eliminar" aria-label="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                `;
            }

            li.innerHTML = `
                <div class="folder-item-content">
                    <i class="fa-${isOwner ? 'regular fa-folder' : 'solid fa-folder-user'}"></i>
                    <span class="folder-name-text" title="${folder.name}">${esc(folder.name)}</span>
                </div>
                ${actionsHtml}
            `;
            
            li.addEventListener('click', (e) => {
                if (e.target.closest('.share-folder-btn') || e.target.closest('.delete-folder-btn')) return;
                activeFilter = folder.id;
                el.header.querySelector('#header-title').textContent = folder.name;
                updateSidebarActive(li);
                renderNotes(el.searchInput.value);
            });

            const deleteBtn = li.querySelector('.delete-folder-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if(confirm(`¿Estás seguro de eliminar la carpeta "${folder.name}"? Las notas que contenga también se eliminarán.`)) {
                        await deleteFolder(folder.id);
                    }
                });
            }

            const shareBtn = li.querySelector('.share-folder-btn');
            if (shareBtn) {
                shareBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openShareModal(folder.id, folder.name);
                });
            }

            el.folderList.appendChild(li);
        });
    }

    async function deleteFolder(id) {
        if (!currentUser || !supabase) return;
        try {
            const { error } = await supabase.from('folders').delete().eq('id', id);
            if (!error) {
                folders = folders.filter(f => f.id !== id);
                notes = notes.filter(n => n.folder_id !== id);
                saveFoldersToStorage();
                saveToStorage();
                if (activeFilter === id) el.navAllNotes.click();
                else renderFoldersSidebar();
                renderNotes();
                showToast('Carpeta eliminada');
            } else {
                showToast('Error al eliminar');
            }
        } catch (err) {
            console.error(err);
        }
    }

    function updateSidebarActive(activeElement) {
        $$('.nav-item').forEach(el => el.classList.remove('active'));
        $$('.folder-item').forEach(el => el.classList.remove('active'));
        if (activeElement) activeElement.classList.add('active');
        if (window.innerWidth <= 768) el.sidebar.classList.remove('open');
    }

    function updateFolderSelects() {
        if (!el.folderDropdownMenu) return;
        
        el.folderDropdownMenu.innerHTML = `
            <button class="dropdown-item active" data-folder-id="">
                <i class="fa-solid fa-folder-minus"></i> Sin carpeta
            </button>
        `;
        
        folders.forEach(f => {
            const btn = document.createElement('button');
            btn.className = 'dropdown-item';
            btn.dataset.folderId = f.id;
            btn.innerHTML = `<i class="fa-regular fa-folder"></i> ${esc(f.name)}`;
            el.folderDropdownMenu.appendChild(btn);
        });

        const items = el.folderDropdownMenu.querySelectorAll('.dropdown-item');
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const folderId = item.dataset.folderId;
                const folderName = item.textContent.trim();
                
                el.noteFolderSelect.value = folderId;
                el.folderDropdownText.textContent = folderName;
                
                items.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                el.folderDropdownMenu.classList.add('hidden');
                
                if (currentNote) {
                    currentNote.folder_id = folderId || null;
                    triggerAutoSave(true);
                }
            });
        });
        
        syncFolderDropdownText();
    }

    function syncFolderDropdownText() {
        if (!el.noteFolderSelect || !el.folderDropdownText || !el.folderDropdownMenu) return;
        const val = el.noteFolderSelect.value || '';
        const items = el.folderDropdownMenu.querySelectorAll('.dropdown-item');
        let found = false;
        items.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.folderId === val) {
                item.classList.add('active');
                el.folderDropdownText.textContent = item.textContent.trim();
                found = true;
            }
        });
        if (!found) {
            el.folderDropdownText.textContent = 'Sin carpeta';
            if (items[0]) items[0].classList.add('active');
        }
    }

    // --- Share Logic ---
    async function openShareModal(folderId, folderName) {
        currentShareFolderId = folderId;
        el.shareEmailInput.value = '';
        el.shareModal.querySelector('h3').textContent = `Compartir "${folderName}"`;
        el.sharedUsersList.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem">Cargando usuarios...</p>';
        el.shareModal.classList.remove('hidden');

        try {
            const { data, error } = await supabase
                .from('shared_folders')
                .select('shared_with_email')
                .eq('folder_id', folderId);

            if (error) throw error;
            
            el.sharedUsersList.innerHTML = '';
            if (data && data.length > 0) {
                data.forEach(share => {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.justifyContent = 'space-between';
                    row.style.alignItems = 'center';
                    row.style.padding = '0.5rem';
                    row.style.borderBottom = '1px solid var(--border-color)';
                    row.style.fontSize = '0.9rem';
                    
                    row.innerHTML = `
                        <span>${esc(share.shared_with_email)}</span>
                        <button class="icon-btn small text-danger remove-share-btn" title="Revocar acceso">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    `;
                    
                    row.querySelector('.remove-share-btn').addEventListener('click', () => {
                        removeShare(folderId, share.shared_with_email, row);
                    });
                    
                    el.sharedUsersList.appendChild(row);
                });
            } else {
                el.sharedUsersList.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem">Nadie tiene acceso aún.</p>';
            }
        } catch (err) {
            console.error(err);
            el.sharedUsersList.innerHTML = '<p style="color:var(--text-danger);font-size:0.8rem">Error al cargar usuarios compartidos.</p>';
        }
    }

    async function shareFolder() {
        if (!currentShareFolderId || !supabase) return;
        const email = el.shareEmailInput.value.trim().toLowerCase();
        if (!email || !email.includes('@')) {
            showToast('Email inválido');
            return;
        }

        el.saveShareBtn.disabled = true;
        try {
            const { error } = await supabase
                .from('shared_folders')
                .insert([{ folder_id: currentShareFolderId, shared_with_email: email }]);

            if (error) {
                if(error.code === '23505') showToast('Usuario ya tiene acceso');
                else showToast('Error al compartir');
            } else {
                showToast(`Carpeta compartida con ${email}`);
                el.shareEmailInput.value = '';
                openShareModal(currentShareFolderId, el.shareModal.querySelector('h3').textContent.replace('Compartir "', '').replace('"', ''));
            }
        } catch (err) {
            console.error(err);
        } finally {
            el.saveShareBtn.disabled = false;
        }
    }

    async function removeShare(folderId, email, rowElement) {
        if (!supabase) return;
        rowElement.style.opacity = '0.5';
        try {
            const { error } = await supabase
                .from('shared_folders')
                .delete()
                .match({ folder_id: folderId, shared_with_email: email });

            if (!error) {
                rowElement.remove();
                if (el.sharedUsersList.children.length === 0) {
                    el.sharedUsersList.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem">Nadie tiene acceso aún.</p>';
                }
            } else {
                showToast('Error al revocar acceso');
                rowElement.style.opacity = '1';
            }
        } catch (err) {
            console.error(err);
            rowElement.style.opacity = '1';
        }
    }

    // Auth handlers
    function setupRealtimeSubscriptions() {
        if (!currentUser || !supabase) return;
        
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
        }

        realtimeChannel = supabase.channel('custom-all-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_folders' }, () => {
                Promise.all([loadFoldersFromSupabase(), loadNotesFromSupabase()]);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, () => {
                Promise.all([loadFoldersFromSupabase(), loadNotesFromSupabase()]);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
                // Only reload if it's NOT the current user's own save (avoid double update)
                if (payload.new?.user_id && payload.new.user_id !== currentUser?.id) {
                    loadNotesFromSupabase();
                } else if (!payload.new?.user_id) {
                    loadNotesFromSupabase();
                }
            })
            .subscribe();
    }

    function handleSession(session) {
        currentUser = session?.user || null;
        
        if (currentUser) {
            el.loginGoogleBtn.style.display = 'none';
            el.userProfileContainer?.classList.remove('hidden');
            el.userProfile.classList.remove('hidden');
            
            const avatarUrl = currentUser.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar/?d=mp';
            const fullName = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Usuario';
            
            el.userAvatar.src = avatarUrl;
            if (el.userName) el.userName.textContent = fullName;
            if (el.dropdownUserName) el.dropdownUserName.textContent = fullName;
            if (el.dropdownUserEmail) el.dropdownUserEmail.textContent = currentUser.email;
            
            const localUserNotes = localStorage.getItem(`minimal_notes_${currentUser.id}`);
            if (localUserNotes) {
                notes = JSON.parse(localUserNotes);
            } else {
                notes = [];
            }
            
            el.foldersSection.classList.remove('hidden');
            el.noteFolderSelector.classList.remove('hidden');
            
            Promise.all([
                loadFoldersFromSupabase(),
                loadNotesFromSupabase()
            ]).then(() => {
                renderFoldersSidebar();
                renderNotes();
                setupRealtimeSubscriptions();
            });
            
        } else {
            el.loginGoogleBtn.style.display = 'flex';
            el.userProfileContainer?.classList.add('hidden');
            el.userDropdownMenu?.classList.remove('show');
            
            el.foldersSection.classList.add('hidden');
            el.noteFolderSelector.classList.add('hidden');
            activeFilter = 'all';
            updateSidebarActive(el.navAllNotes);
            
            leaveColabChannel();
            if (realtimeChannel) {
                supabase.removeChannel(realtimeChannel);
                realtimeChannel = null;
            }
            
            notes = JSON.parse(localStorage.getItem('minimal_notes')) || [];
            folders = [];
            renderFoldersSidebar();
            renderNotes();
        }
    }

    function generateId() {
        return crypto.randomUUID ? crypto.randomUUID() : 'n_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }

    function renderNotes(searchTerm = '', animate = true) {
        el.grid.innerHTML = '';
        const term = searchTerm.trim().toLowerCase();

        let filtered = notes;

        if (activeFilter === 'shared') {
            filtered = notes.filter(n => n.shared);
        } else if (activeFilter !== 'all') {
            filtered = notes.filter(n => n.folder_id === activeFilter);
        } else {
            filtered = notes.filter(n => !n.folder_id && !n.shared);
        }

        if (term) {
            filtered = filtered.filter(n =>
                (n.title || '').toLowerCase().includes(term) ||
                (n.body || '').toLowerCase().includes(term) ||
                (n.tags && n.tags.some(t => t.toLowerCase().includes(term.replace('#',''))))
            );
        }

        const hasNotes = notes.length > 0;
        const hasResults = filtered.length > 0;

        el.emptyState.classList.toggle('hidden', hasNotes || !!term);
        el.noResults.classList.toggle('hidden', !term || hasResults);
        el.noteCount.textContent = notes.length;

        filtered.sort((a, b) => {
            if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
            if (sortMode === 'alpha') {
                return (a.title || '').localeCompare(b.title || '', 'es');
            }
            return b.updatedAt - a.updatedAt;
        });

        if (typeof marked !== 'undefined') {
            const renderer = new marked.Renderer();
            renderer.code = function(codeArg, langArg) {
                let code = '';
                let language = 'plaintext';
                
                if (typeof codeArg === 'object' && codeArg !== null) {
                    code = codeArg.text || '';
                    language = codeArg.lang || 'plaintext';
                } else {
                    code = codeArg || '';
                    language = langArg || 'plaintext';
                }

                language = (language || '').split(/\\s+/)[0] || 'plaintext';

                let highlighted;
                try {
                    if (typeof hljs !== 'undefined' && hljs.getLanguage(language)) {
                        highlighted = hljs.highlight(code, { language }).value;
                    } else if (typeof hljs !== 'undefined') {
                        highlighted = hljs.highlightAuto(code).value;
                    } else {
                        highlighted = esc(code);
                    }
                } catch(e) { highlighted = esc(code); }
                
                return `
                    <div class="code-block-wrapper">
                        <div class="code-block-header">
                            <span>${language}</span>
                            <button onclick="window.copyCodeFromButton(this)">
                                <i class="fa-regular fa-copy"></i> Copiar
                            </button>
                        </div>
                        <pre><code class="hljs language-${language}">${highlighted}</code></pre>
                    </div>
                `;
            };
            marked.setOptions({ breaks: true, gfm: true, renderer });
        }

        filtered.forEach((note, index) => {
            const card = document.createElement('div');
            card.className = `note-card ${note.pinned ? 'pinned' : ''}`;
            card.dataset.id = note.id;
            
            if (animate) {
                const delay = Math.min(index * 0.05, 0.5);
                card.style.setProperty('--animation-order', `${delay}s`);
            } else {
                card.style.animation = 'none';
                card.style.opacity = '1';
                card.style.transform = 'none';
            }

            if (note.color && note.color !== 'default') {
                card.style.backgroundColor = `var(--color-${note.color})`;
            }

            const title = esc(note.title || 'Sin titulo');
            const dateStr = relativeTime(note.updatedAt);

            const tagsMap = Array.isArray(note.tags) ? note.tags : [];
            let tagsHtml = '';
            if (tagsMap.length > 0) {
                tagsHtml = `<div class="note-tags">${tagsMap.map(t => `<span class="note-tag" onclick="window.searchForTag('${t}', event)">${t}</span>`).join('')}</div>`;
            }

            let bodyHtml;
            if (typeof marked !== 'undefined' && note.body) {
                bodyHtml = marked.parse(note.body);
            } else {
                bodyHtml = `<p>${esc(note.body || '')}</p>`;
            }

            card.innerHTML = `
                <div class="note-header">
                    <h3 class="note-title">${title}</h3>
                    <div class="note-icons">
                        ${note.pinned ? '<i class="fa-solid fa-thumbtack note-pinned-icon"></i>' : ''}
                    </div>
                </div>
                ${tagsHtml}
                <div class="note-body-preview">${bodyHtml}</div>
                <div class="note-footer">
                    <span>${dateStr}</span>
                    <div class="card-actions">
                        <button class="card-action-btn dup-card-btn" title="Duplicar" aria-label="Duplicar"><i class="fa-regular fa-copy"></i></button>
                        <button class="card-action-btn danger delete-card-btn" title="Eliminar" aria-label="Eliminar"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
            el.grid.appendChild(card);
        });
    }

    // ========================================
    // MODAL
    // ========================================

    function openModal(note = null) {
        if (note) {
            currentNote = { ...note };
        } else {
            currentNote = {
                id: generateId(),
                title: '',
                tags: [],
                body: '',
                pinned: false,
                color: 'default',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
        }

        el.titleInput.value = currentNote.title || '';
        el.tagsInput.value = Array.isArray(currentNote.tags) ? currentNote.tags.join(', ') : '';
        el.bodyInput.value = currentNote.body || '';
        el.noteFolderSelect.value = currentNote.folder_id || (activeFilter !== 'all' && activeFilter !== 'shared' ? activeFilter : '');
        if (typeof syncFolderDropdownText === 'function') syncFolderDropdownText();
        el.pinBtn.classList.toggle('active', currentNote.pinned);
        setActiveColorDot(currentNote.color);
        el.saveStatus.classList.remove('visible');
        updateCounts();
        updateDateInfo();

        // Setup initial mode
        isPreviewMode = !!note;
        
        el.bodyInput.classList.toggle('hidden', isPreviewMode);
        el.previewBody.classList.toggle('hidden', !isPreviewMode);
        el.toolbar.classList.toggle('hidden', isPreviewMode);
        remoteCursorOverlay.style.display = isPreviewMode ? 'none' : 'block';
        
        const icon = el.togglePreviewBtn.querySelector('i');
        if (isPreviewMode) {
            icon.className = 'fa-solid fa-pen';
            
            const rawMarkdown = el.bodyInput.value || '*Nada que previsualizar*';
            let markdown = typeof marked !== 'undefined' ? marked.parse(rawMarkdown) : '<p>Error cargando preview</p>';
            
            markdown = markdown.replace(/<input disabled="" type="checkbox"/g, '<input type="checkbox" class="interactive-checkbox"');
            markdown = markdown.replace(/<input type="checkbox" disabled=""/g, '<input type="checkbox" class="interactive-checkbox"');

            el.previewBody.innerHTML = markdown;
            
            setTimeout(() => {
                const checkboxes = el.previewBody.querySelectorAll('.interactive-checkbox');
                checkboxes.forEach((cb, index) => {
                    cb.addEventListener('change', (e) => {
                        toggleMarkdownCheckbox(index, e.target.checked);
                    });
                });
            }, 10);
        } else {
            icon.className = 'fa-solid fa-eye';
        }

        el.modal.classList.remove('hidden');

        // 🔴 JOIN COLLABORATIVE CHANNEL for this note
        if (currentUser && currentNote.id) {
            joinColabChannel(currentNote.id);
        }

        setTimeout(() => {
            if (!isPreviewMode) {
                if (!currentNote.title) el.titleInput.focus();
                else { el.bodyInput.focus(); el.bodyInput.selectionStart = el.bodyInput.value.length; }
            }
        }, 60);
    }

    function closeModal() {
        const hasContent = el.titleInput.value.trim() || el.bodyInput.value.trim();

        if (currentNote && hasContent) {
            forceSave();
        } else if (currentNote) {
            notes = notes.filter(n => n.id !== currentNote.id);
            saveToStorage();
        }

        // 🔴 LEAVE COLLABORATIVE CHANNEL
        leaveColabChannel();

        el.modal.classList.add('hidden');
        currentNote = null;
        renderNotes(el.searchInput.value, false);
    }

    function triggerAutoSave(immediate = false) {
        if (autoSaveTimer) clearTimeout(autoSaveTimer);
        el.saveStatus.textContent = 'Guardando...';
        el.saveStatus.classList.add('visible');

        if (immediate) { forceSave(); return; }
        autoSaveTimer = setTimeout(forceSave, 800);
    }

    function forceSave() {
        if (!currentNote) return;

        currentNote.title = el.titleInput.value;
        const rawTags = el.tagsInput.value.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
        currentNote.tags = [...new Set(rawTags)];
        currentNote.body = el.bodyInput.value;
        currentNote.updatedAt = Date.now();
        currentNote.folder_id = el.noteFolderSelect.value || null;

        const idx = notes.findIndex(n => n.id === currentNote.id);
        if (idx > -1) notes[idx] = { ...currentNote };
        else notes.push({ ...currentNote });

        saveToStorage();
        if (currentUser) syncNoteToSupabase(currentNote);

        el.saveStatus.textContent = 'Guardado';
        setTimeout(() => {
            if (el.saveStatus.textContent === 'Guardado') el.saveStatus.classList.remove('visible');
        }, 1500);
    }

    // ========================================
    // ACTIONS
    // ========================================

    function deleteNote(id) {
        const card = el.grid.querySelector(`.note-card[data-id="${id}"]`);
        if (card) {
            card.classList.add('removing');
            setTimeout(() => {
                const idx = notes.findIndex(n => n.id === id);
                if (idx > -1) {
                    deletedNote = notes[idx];
                    notes.splice(idx, 1);
                    saveToStorage();
                    if (currentUser) deleteNoteFromSupabase(id);
                    renderNotes(el.searchInput.value);
                    showToast('Nota eliminada');
                }
            }, 250);
        }
    }

    function duplicateNote(id) {
        const original = notes.find(n => n.id === id);
        if (!original) return;
        const dup = {
            id: generateId(),
            title: original.title ? original.title + ' (copia)' : '',
            tags: original.tags ? [...original.tags] : [],
            body: original.body,
            pinned: false,
            color: original.color,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        notes.push(dup);
        saveToStorage();
        renderNotes(el.searchInput.value);
        showToast('Nota duplicada');
    }

    function exportNotes() {
        if (notes.length === 0) { showToast('No hay notas para exportar'); return; }
        const data = JSON.stringify(notes, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notas_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Notas exportadas');
        el.dropdownMenu.classList.add('hidden');
    }

    function importNotes(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                if (!Array.isArray(imported)) throw new Error('Formato invalido');

                let count = 0;
                imported.forEach(n => {
                    if (n.id && !notes.find(ex => ex.id === n.id)) {
                        notes.push({
                            id: n.id,
                            title: n.title || '',
                            tags: Array.isArray(n.tags) ? n.tags : [],
                            body: n.body || '',
                            pinned: !!n.pinned,
                            color: n.color || 'default',
                            createdAt: n.createdAt || Date.now(),
                            updatedAt: n.updatedAt || Date.now()
                        });
                        count++;
                    }
                });

                saveToStorage();
                renderNotes();
                showToast(`${count} nota(s) importada(s)`);
            } catch (err) {
                showToast('Error: archivo no valido');
            }
        };
        reader.readAsText(file);
        el.importFile.value = '';
        el.dropdownMenu.classList.add('hidden');
    }

    function setSortMode(mode) {
        sortMode = mode;
        localStorage.setItem('minimal_sort', mode);
        el.sortDateBtn.classList.toggle('active', mode === 'date');
        el.sortAlphaBtn.classList.toggle('active', mode === 'alpha');
        renderNotes(el.searchInput.value);
        el.dropdownMenu.classList.add('hidden');
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('minimal_theme', next);
        updateThemeIcon(next);
        
        const hljsLink = document.getElementById('hljs-theme');
        if (hljsLink) {
            if (next === 'light') {
                hljsLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/atom-one-light.min.css';
            } else {
                hljsLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/atom-one-dark.min.css';
            }
        }
    }

    // ========================================
    // UI HELPERS
    // ========================================

    function updateCounts() {
        const body = el.bodyInput.value;
        const words = body.trim() ? body.trim().split(/\s+/).length : 0;
        const chars = body.length;
        el.wordCount.textContent = `${words} palabra${words !== 1 ? 's' : ''}`;
        el.charCount.textContent = `${chars} car.`;
    }

    function updateDateInfo() {
        if (!currentNote) return;
        const created = new Date(currentNote.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        el.dateInfo.textContent = `Creada: ${created}`;
    }

    function setActiveColorDot(color) {
        el.colorDots.forEach(d => d.classList.toggle('active', d.dataset.color === color));
    }

    function updateThemeIcon(theme) {
        const icon = el.themeToggle.querySelector('i');
        icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    function showToast(message) {
        if (toastTimer) clearTimeout(toastTimer);
        el.toastMessage.textContent = message;
        el.toast.classList.remove('hidden');
        void el.toast.offsetWidth;
        el.toast.classList.add('visible');
        toastTimer = setTimeout(hideToast, 4000);
    }

    function hideToast() {
        el.toast.classList.remove('visible');
        setTimeout(() => {
            if (!el.toast.classList.contains('visible')) {
                el.toast.classList.add('hidden');
                deletedNote = null;
            }
        }, 300);
    }

    function relativeTime(ts) {
        const now = Date.now();
        const diff = now - ts;
        const sec = Math.floor(diff / 1000);
        const min = Math.floor(sec / 60);
        const hr = Math.floor(min / 60);
        const day = Math.floor(hr / 24);

        if (sec < 60) return 'Ahora';
        if (min < 60) return `Hace ${min} min`;
        if (hr < 24) return `Hace ${hr}h`;
        if (day < 7) return `Hace ${day}d`;
        return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }

    function esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    async function generateAIContent(prompt) {
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            const data = await response.json();
            if (data.text) {
                let result = data.text.trim();
                if (result.startsWith('```markdown')) result = result.substring(11).trim();
                else if (result.startsWith('```')) result = result.substring(3).trim();
                if (result.endsWith('```')) result = result.substring(0, result.length - 3).trim();
                return result;
            }
            throw new Error('No content in response');
        } catch (error) {
            console.error('Error generating AI content:', error);
            return null;
        }
    }

    // Init sort buttons UI
    el.sortDateBtn.classList.toggle('active', sortMode === 'date');
    el.sortAlphaBtn.classList.toggle('active', sortMode === 'alpha');
    
    // Global functions for inline HTML events
    window.copyCodeFromButton = function(btn) {
        const wrapper = btn.closest('.code-block-wrapper');
        const codeElement = wrapper.querySelector('pre code');
        const code = codeElement.textContent;
        navigator.clipboard.writeText(code).then(() => {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado';
            setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
        }).catch(() => {
            console.error('No se pudo copiar el texto');
        });
    };

    window.searchForTag = function(tag, e) {
        if (e) e.stopPropagation();
        el.searchInput.value = tag;
        el.searchInput.dispatchEvent(new Event('input'));
        el.searchInput.focus();
    };

    window.closeModalFromGlobal = function() {
        const closeBtn = document.getElementById('close-modal-btn');
        if (closeBtn) closeBtn.click();
    };
});