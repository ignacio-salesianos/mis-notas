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
        noteFolderSelect: $('#note-folder-select')
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
    let sortMode = localStorage.getItem('minimal_sort') || 'date'; // 'date' | 'alpha'
    let activeFilter = 'all'; // 'all' | 'shared' | folderId
    let currentShareFolderId = null;
    let realtimeChannel = null;

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
        el.addAiBtn.addEventListener('click', async () => {
            const topic = prompt("¿Sobre qué quieres que trate la nota?");
            if (!topic) return;
            
            showToast('Generando nota con IA...');
            const aiContent = await generateAIContent(`Crea una nota clara y estructurada sobre: ${topic}. Usa formato markdown, pero NO incluyas un título grande de primer nivel al inicio (yo ya pongo el título en otra parte).`);
            
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
                openModal(newNote);
            } else {
                showToast('Error al generar la nota');
            }
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
    document.addEventListener('click', () => el.dropdownMenu.classList.add('hidden'));

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

    el.titleInput.addEventListener('input', () => { updateCounts(); triggerAutoSave(); });
    el.bodyInput.addEventListener('input', () => { updateCounts(); triggerAutoSave(); });

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
        
        const icon = el.togglePreviewBtn.querySelector('i');
        if (isPreviewMode) {
            icon.className = 'fa-solid fa-pen';
            
            const rawMarkdown = el.bodyInput.value || '*Nada que previsualizar*';
            let markdown = typeof marked !== 'undefined' ? marked.parse(rawMarkdown) : '<p>Error cargando preview</p>';
            
            // Un-disable checkboxes for interactivity
            markdown = markdown.replace(/<input disabled="" type="checkbox"/g, '<input type="checkbox" class="interactive-checkbox"');
            markdown = markdown.replace(/<input type="checkbox" disabled=""/g, '<input type="checkbox" class="interactive-checkbox"');

            el.previewBody.innerHTML = markdown;
            
            // Add listeners to checkboxes
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
        
        // Save automatically
        triggerAutoSave(true);
        // We do NOT re-render preview immediately to not destroy user focus/scrolling
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
                if (action === 'ai-order') {
                    prompt = `Organiza el siguiente texto en una lista de puntos clave clara y estructurada, descartando relleno innecesario. Responde SÓLO con el texto formateado en markdown:\n\n${textToProcess}`;
                } else if (action === 'ai-summarize') {
                    prompt = `Resume el siguiente texto de la forma más concisa y minimalista posible, conservando la idea principal. Responde SÓLO con el resumen:\n\n${textToProcess}`;
                } else if (action === 'ai-extend') {
                    prompt = `Extiende y desarrolla detalladamente la siguiente idea o texto, añadiendo contexto, ejemplos o explicaciones relevantes. Responde SÓLO con el texto ampliado en formato markdown:\n\n${textToProcess}`;
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

    // ========================================
    // CORE FUNCTIONS
    // ========================================

    function saveToStorage() {
        if (currentUser && supabase) {
            // Guardar local as backup
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
            // RLS automatically filters only notes we own OR notes in folders shared with us
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
                if (notes.some(n => n.folder_id && !n.shared)) {
                    // There are notes in folders, make sure those folders are active in the dropdown 
                }
            }
        } catch (err) {
            console.error('Network error fetching from Supabase:', err);
        }
    }

    async function loadFoldersFromSupabase() {
        if (!currentUser || !supabase) return;
        
        try {
            // Fetch all folders we have access to (both owned and shared via RLS)
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

            // Delete folder action
            const deleteBtn = li.querySelector('.delete-folder-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if(confirm(`¿Estás seguro de eliminar la carpeta "${folder.name}"? Las notas que contenga también se eliminarán.`)) {
                        await deleteFolder(folder.id);
                    }
                });
            }

            // Share folder action
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
        // Clear except first "Sin carpeta"
        while (el.noteFolderSelect.options.length > 1) {
            el.noteFolderSelect.remove(1);
        }
        
        folders.forEach(f => {
            const option = document.createElement('option');
            option.value = f.id;
            option.textContent = f.name;
            el.noteFolderSelect.appendChild(option);
        });
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
                // Reload list
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
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'shared_folders' },
                () => {
                    console.log('Cambio en shared_folders detectado');
                    Promise.all([
                        loadFoldersFromSupabase(),
                        loadNotesFromSupabase()
                    ]);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'folders' },
                () => {
                    console.log('Cambio en folders detectado');
                    Promise.all([
                        loadFoldersFromSupabase(),
                        loadNotesFromSupabase()
                    ]);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notes' },
                () => {
                    console.log('Cambio en notes detectado');
                    loadNotesFromSupabase();
                }
            )
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
            
            // Cargar local primero, luego sincronizar
            const localUserNotes = localStorage.getItem(`minimal_notes_${currentUser.id}`);
            if (localUserNotes) {
                notes = JSON.parse(localUserNotes);
            } else {
                notes = [];
            }
            
            el.foldersSection.classList.remove('hidden');
            el.noteFolderSelector.classList.remove('hidden');
            
            // Cargar datos
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
            
            if (realtimeChannel) {
                supabase.removeChannel(realtimeChannel);
                realtimeChannel = null;
            }
            
            // Volver a notas en local storage anónimo
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

        // Folder filtering
        if (activeFilter === 'shared') {
            filtered = notes.filter(n => n.shared);
        } else if (activeFilter !== 'all') {
            filtered = notes.filter(n => n.folder_id === activeFilter);
        } else {
            // "Todas mis notas": Only show notes WITHOUT a folder and that are NOT shared
            filtered = notes.filter(n => !n.folder_id && !n.shared);
        }

        if (term) {
            filtered = filtered.filter(n =>
                (n.title || '').toLowerCase().includes(term) ||
                (n.body || '').toLowerCase().includes(term) ||
                (n.tags && n.tags.some(t => t.toLowerCase().includes(term.replace('#',''))))
            );
        }

        // Show/hide states
        const hasNotes = notes.length > 0;
        const hasResults = filtered.length > 0;

        el.emptyState.classList.toggle('hidden', hasNotes || !!term);
        el.noResults.classList.toggle('hidden', !term || hasResults);
        el.noteCount.textContent = notes.length;

        // Sort
        filtered.sort((a, b) => {
            if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
            if (sortMode === 'alpha') {
                return (a.title || '').localeCompare(b.title || '', 'es');
            }
            return b.updatedAt - a.updatedAt;
        });

        // Configure marked with highlight.js renderer
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
                if (savedTheme === 'dark') {
                     card.style.backgroundColor = `var(--color-${note.color})`;
                } else {
                     card.style.backgroundColor = `var(--color-${note.color})`;
                }
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
                // For preview cards, we generally want them disabled so they don't capture clicks
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
        el.pinBtn.classList.toggle('active', currentNote.pinned);
        setActiveColorDot(currentNote.color);
        el.saveStatus.classList.remove('visible');
        updateCounts();
        updateDateInfo();

        // Reset preview
        isPreviewMode = false;
        el.bodyInput.classList.remove('hidden');
        el.previewBody.classList.add('hidden');
        el.toolbar.classList.remove('hidden');
        el.togglePreviewBtn.querySelector('i').className = 'fa-solid fa-eye';

        el.modal.classList.remove('hidden');

        setTimeout(() => {
            if (!currentNote.title) el.titleInput.focus();
            else { el.bodyInput.focus(); el.bodyInput.selectionStart = el.bodyInput.value.length; }
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
            // Parse tags
            const rawTags = el.tagsInput.value.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
            currentNote.tags = [...new Set(rawTags)];
            currentNote.body = el.bodyInput.value;
            currentNote.updatedAt = Date.now();
            
            // Parse Folder
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
        
        // Update highlight.js theme if possible
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
        void el.toast.offsetWidth; // reflow
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

    // AI Generation global function
    async function generateAIContent(prompt) {
        const apiKey = 'AIzaSyALnXifCXMiFHG_12wtBMBX1shEgUPIgQQ';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemma-2-27b-it:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7 }
                })
            });

            const data = await response.json();
            if (data.candidates && data.candidates[0].content.parts[0].text) {
                return data.candidates[0].content.parts[0].text.trim();
            }
            throw new Error('No content in response');
        } catch (error) {
            console.error('Error generating AI content:', error);
            // Fallback for Gemini if Gemma is not loaded into the endpoint yet
            try {
                const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                const fallbackResponse = await fetch(fallbackUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.7 }
                    })
                });
                const fData = await fallbackResponse.json();
                if (fData.candidates && fData.candidates[0].content.parts[0].text) {
                    return fData.candidates[0].content.parts[0].text.trim();
                }
            } catch (e) {
                console.error('Fallback failed:', e);
            }
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
        const code = codeElement.textContent; // Using textContent retains newlines and ignores HTML tags
        navigator.clipboard.writeText(code).then(() => {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado';
            setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
        }).catch(() => {
            // fallback if clipboard fails
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
