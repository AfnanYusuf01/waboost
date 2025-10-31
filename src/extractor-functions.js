// WhatsApp Blaze - Extractor Functions

// ============================================================================
// DATA EXTRACTION - CONTACTS
// ============================================================================

async function loadContacts() {
    showLoading('contactsTableBody', 'Memuat data kontak...');
    await injectWAPIScript();
    try {
        addStatusLog('📞 Memulai ekstraksi kontak...');
        await ensureWebViewReady();

        const script = `
            (function() {
                try {
                    if (typeof window.WWebJS === 'undefined') {
                        return { success: false, error: 'WAPI not available' };
                    }                    
                    const contacts = window.WWebJS.getContacts();
                    
                    if (!contacts || !Array.isArray(contacts)) {
                        return { success: false, error: 'Invalid contacts data' };
                    }
                    
                    console.log('Raw contacts:', contacts); // Debug log
                    
                    const filteredContacts = contacts
                        .filter(contact => {
                            // Filter kontak yang valid
                            if (!contact || !contact.id) return false;
                            
                            // Pastikan ID berakhir dengan @c.us (kontak personal)
                            const isPersonalContact = contact.id._serialized ? 
                                contact.id._serialized.endsWith('@c.us') : 
                                contact.id.endsWith('@c.us');
                            
                            if (!isPersonalContact) return false;
                            
                            // Filter kontak yang memiliki nama atau pushname
                            const hasName = contact.name && contact.name.trim() !== '';
                            const hasPushName = contact.pushname && contact.pushname.trim() !== '';
                            const hasShortName = contact.shortName && contact.shortName.trim() !== '';
                            
                            return hasName || hasPushName || hasShortName;
                        })
                        .map(contact => {
                            // Ekstrak nomor telepon
                            let cleanNumber = '';
                            if (contact.id._serialized) {
                                cleanNumber = contact.id._serialized.split('@')[0];
                            } else if (typeof contact.id === 'string') {
                                cleanNumber = contact.id.split('@')[0];
                            } else if (contact.id.user) {
                                cleanNumber = contact.id.user;
                            }
                            
                            // Tentukan nama yang akan ditampilkan
                            let displayName = 'Unknown';
                            
                            if (contact.name && contact.name.trim() !== '') {
                                displayName = contact.name;
                            } else if (contact.pushname && contact.pushname.trim() !== '') {
                                displayName = contact.pushname;
                            } else if (contact.shortName && contact.shortName.trim() !== '') {
                                displayName = contact.shortName;
                            }
                            
                            return {
                                id: contact.id._serialized || contact.id,
                                number: cleanNumber,
                                name: displayName,
                                pushname: contact.pushname || '',
                                shortName: contact.shortName || '',
                                isBusiness: contact.isBusiness || false,
                                isUser: contact.isUser || false,
                                isWAContact: contact.isWAContact || false,
                                isMe: contact.isMe || false,
                                type: contact.type || 'unknown'
                            };
                        })
                        .filter(contact => {
                            // Filter akhir untuk memastikan tidak ada yang Unknown
                            return !contact.name.contains('Unknown') && 
                                   contact.name.trim() !== '' && 
                                   contact.number !== '';
                        })
                        // Sort by name
                        .sort((a, b) => a.name.localeCompare(b.name));

                    console.log('Filtered contacts:', filteredContacts); // Debug log
                    
                    return { 
                        success: true, 
                        data: filteredContacts,
                        count: filteredContacts.length,
                        rawCount: contacts.length
                    };
                } catch (error) {
                    console.error('Contact extraction error:', error);
                    return { success: false, error: error.message };
                }
            })();
        `;

        const result = await executeInWebView(script);
        
        if (result && result.success) {
            const contacts = result.data || [];
            currentData.contacts = contacts;
            displayContactsTable(contacts);
            updateCount('contactsCount', contacts.length);
            
            const rawCount = result.rawCount || 0;
            addStatusLog(`✅ Berhasil mendapatkan ${contacts.length} kontak (dari ${rawCount} total)`);
            showNotification(`Berhasil memuat ${contacts.length} kontak`, 'success');
        } else {
            const errorMsg = result?.error || 'Unknown error';
            addStatusLog('❌ Gagal memuat kontak: ' + errorMsg);
            showNotification('Gagal memuat kontak', 'error');
        }

    } catch (error) {
        console.error('Load contacts error:', error);
        addStatusLog('❌ Error: ' + error.message);
        showNotification('Error saat memuat kontak', 'error');
    }
}

async function saveContacts() {
    if (currentData.contacts.length === 0) {
        showNotification('Tidak ada data kontak untuk disimpan.', 'warning');
        return;
    }

    addStatusLog('💾 Menyimpan data kontak ke CSV...');
    
    try {
        const csvContent = generateContactsCSV(currentData.contacts);
        downloadCSV(csvContent, 'whatsapp-contacts');
        addStatusLog('✅ Data kontak berhasil disimpan');
        showNotification('Data kontak berhasil disimpan', 'success');
    } catch (error) {
        addStatusLog('❌ Gagal menyimpan data kontak: ' + error.message);
        showNotification('Gagal menyimpan data kontak', 'error');
    }
}

async function exportContactsToTarget() {
    if (currentData.contacts.length === 0) {
        showNotification('Tidak ada data kontak untuk diexport.', 'warning');
        return;
    }

    addStatusLog('🎯 Mengekspor kontak ke Automation...');

    const automationContacts = currentData.contacts.map(contact => ({
        id: contact.id.replace('@c.us', ''),
        name: contact.name,
        number: contact.number,
        pushname: contact.pushname,
        isBusiness: contact.isBusiness,
        status: 'Pending',
        source: 'Contact List'
    }));

    const existingIds = new Set(currentData.sendingContacts.map(c => c.id));
    const newContacts = automationContacts.filter(contact => !existingIds.has(contact.id));

    if (newContacts.length > 0) {
        currentData.sendingContacts.push(...newContacts);
        displaySendingContactsTable(currentData.sendingContacts);
        updateCount('sendingContactsCount', currentData.sendingContacts.length);
        
        addStatusLog(`✅ ${newContacts.length} kontak berhasil ditambahkan ke Automation`);
        showNotification(`${newContacts.length} kontak ditambahkan ke Automation`, 'success');
        
        switchMainTab('automation');
    } else {
        addStatusLog('ℹ️ Semua kontak sudah ada di Automation');
        showNotification('Semua kontak sudah ada di Automation', 'info');
    }
}

function clearContacts() {
    if (currentData.contacts.length === 0) {
        addStatusLog('ℹ️ Data kontak sudah kosong');
        return;
    }

    if (confirm('Apakah Anda yakin ingin menghapus semua data kontak?')) {
        currentData.contacts = [];
        displayContactsTable([]);
        updateCount('contactsCount', 0);
        addStatusLog('🗑️ Data kontak berhasil dibersihkan');
        showNotification('Data kontak dibersihkan', 'info');
    }
}

// ============================================================================
// DATA EXTRACTION - CHAT CONTACTS
// ============================================================================

async function loadChatContacts() {
    showLoading('chatContactsTableBody', 'Memuat data chat...');
    await injectWAPIScript();
    try {
        addStatusLog('💬 Memulai ekstraksi chat contacts...');
        await ensureWebViewReady();

        const script = `  (async function() {
      try {
          if (typeof window.WWebJS === 'undefined') {
              return {
                  success: false,
                  error: 'Store.Chat not available'
              };
          }
          let chats = [];
          const allChats = await window.WWebJS.getChats();
          const chatList = [];
          for (let chat of allChats) {
              let chatId = chat.id._serialized;
              let type = 'unknown';
              let finalId = chatId;
              if (chatId.includes('@c.us')) {
                  type = 'personal';
                  finalId = chatId.replace('@c.us', '');
              } else if (chatId.includes('@g.us')) {
                  type = 'group';
                  finalId = chatId.replace('@g.us', '');
              } else if (chatId.includes('@lid')) {
                  // Resolve LID ke kontak
                  try {
                      const contact = await window.WWebJS.getContact(chatId);
                      const resolvedId = contact.id._serialized;

                      if (resolvedId.includes('@c.us')) {
                          type = 'personal';
                          finalId = resolvedId.replace('@c.us', '');
                      } else if (resolvedId.includes('@g.us')) {
                          type = 'group';
                          finalId = resolvedId.replace('@g.us', '');
                      } else {
                          continue; // Skip jika tidak bisa di-resolve
                      }
                  } catch (error) {
                      continue; // Skip jika error
                  }
              } else {
                  continue; // Skip tipe lain
              }
              chatList.push({
                  id: finalId,
                  type: type
              });
          }
          return {
              success: true,
              data: chatList,
              count: chatList.length
          };

      } catch (error) {
          return {
              success: false,
              error: error.message
          };
      }
  })();`;

        const result = await executeInWebView(script);
        
        if (result && result.success) {
            console.log('Chat contacts extraction result:', result); // Debug log
            const chats = result.data || [];

            currentData.chatContacts = chats;
            displayChatContactsTable(chats);
            updateCount('chatContactsCount', chats.length);
            addStatusLog(`✅ Berhasil memuat ${chats.length} chat`);
            showNotification(`Berhasil memuat ${chats.length} chat`, 'success');
        } else {
            const errorMsg = result?.error || 'Unknown error';
            addStatusLog('❌ Gagal memuat chat: ' + errorMsg);
            showNotification('Gagal memuat chat', 'error');
        }
        
    } catch (error) {
        addStatusLog('❌ Gagal memuat chat: ' + error.message);
        showNotification('Error saat memuat chat', 'error');
    }
}

async function saveChatContacts() {
    if (currentData.chatContacts.length === 0) {
        showNotification('Tidak ada data chat untuk disimpan.', 'warning');
        return;
    }

    addStatusLog('💾 Menyimpan data chat ke CSV...');
    
    try {
        const csvContent = generateChatContactsCSV(currentData.chatContacts);
        downloadCSV(csvContent, 'whatsapp-chats');
        addStatusLog('✅ Data chat berhasil disimpan');
        showNotification('Data chat berhasil disimpan', 'success');
    } catch (error) {
        addStatusLog('❌ Gagal menyimpan data chat: ' + error.message);
        showNotification('Gagal menyimpan data chat', 'error');
    }
}

async function exportChatContactsToTarget() {
    if (currentData.chatContacts.length === 0) {
        showNotification('Tidak ada data chat untuk diexport.', 'warning');
        return;
    }

    addStatusLog('🎯 Mengekspor chat contacts ke Automation...');

    const chatContacts = currentData.chatContacts.filter(chat => chat.type !== "group");
    const chatGroups = currentData.chatContacts.filter(chat => chat.type === "group");

    let addedContactsCount = 0;
    let addedGroupsCount = 0;

    if (chatContacts.length > 0) {
        const automationContacts = chatContacts.map(chat => ({
            id: chat.id.replace('@c.us', ''),
            name: chat.name,
            number: extractNumberFromChatId(chat.id),
            status: 'Pending',
            source: 'Chat Contact'
        }));

        const existingContactIds = new Set(currentData.sendingContacts.map(c => c.id));
        const newContacts = automationContacts.filter(contact => !existingContactIds.has(contact.id));
        
        if (newContacts.length > 0) {
            currentData.sendingContacts.push(...newContacts);
            addedContactsCount = newContacts.length;
        }
    }

    if (chatGroups.length > 0) {
        const automationGroups = chatGroups.map(group => ({
            id: group.id.replace('@g.us', ''),
            name: group.name,
            participantCount: group.participantCount || 0,
            status: 'Pending',
            source: 'Chat Group'
        }));

        const existingGroupIds = new Set(currentData.sendingGroups.map(g => g.id));
        const newGroups = automationGroups.filter(group => !existingGroupIds.has(group.id));
        
        if (newGroups.length > 0) {
            currentData.sendingGroups.push(...newGroups);
            addedGroupsCount = newGroups.length;
        }
    }

    if (addedContactsCount > 0) {
        displaySendingContactsTable(currentData.sendingContacts);
        updateCount('sendingContactsCount', currentData.sendingContacts.length);
    }

    if (addedGroupsCount > 0) {
        displaySendingGroupsTable(currentData.sendingGroups);
        updateCount('sendingGroupsCount', currentData.sendingGroups.length);
    }

    if (addedContactsCount > 0 || addedGroupsCount > 0) {
        addStatusLog(`✅ ${addedContactsCount} kontak dan ${addedGroupsCount} grup berhasil ditambahkan`);
        showNotification(`${addedContactsCount} kontak dan ${addedGroupsCount} grup ditambahkan`, 'success');
        
        switchMainTab('automation');
    } else {
        addStatusLog('ℹ️ Semua chat contacts/groups sudah ada di Automation');
        showNotification('Semua data chat sudah ada di Automation', 'info');
    }
}

function clearChatContacts() {
    if (currentData.chatContacts.length === 0) {
        addStatusLog('ℹ️ Data chat sudah kosong');
        return;
    }

    if (confirm('Apakah Anda yakin ingin menghapus semua data chat?')) {
        currentData.chatContacts = [];
        displayChatContactsTable([]);
        updateCount('chatContactsCount', 0);
        addStatusLog('🗑️ Data chat berhasil dibersihkan');
        showNotification('Data chat dibersihkan', 'info');
    }
}

// ============================================================================
// DATA EXTRACTION - GROUPS
// ============================================================================

async function loadGroups() {
    showLoading('groupsTableBody', 'Memuat data grup...');
    await injectWAPIScript();
    try {
        addStatusLog('👥 Memulai ekstraksi grup...');
        await ensureWebViewReady();

        const script = `
            (async function() {
                try {
                    // Approach 1: Gunakan WWebJS jika tersedia
                    if (typeof window.WWebJS !== 'undefined' && typeof window.WWebJS.getChats === 'function') {
                        const allChats = await window.WWebJS.getChats();
                        
                        // Filter hanya group (@g.us) dan ambil hanya name dan id
                        const groups = allChats
                            .filter(chat => chat.id._serialized.endsWith('@g.us'))
                            .map(chat => ({
                                id: chat.id._serialized,
                                name: chat.name || chat.formattedTitle || 'Unknown Group'
                            }));
                        
                        return { 
                            success: true, 
                            data: groups,
                            count: groups.length,
                            source: 'WWebJS'
                        };
                    }
                    
                    // Approach 2: Fallback ke Store.Chat
                    if (typeof window.Store === 'undefined' || typeof window.Store.Chat === 'undefined') {
                        return { success: false, error: 'Store.Chat not available' };
                    }
                    
                    let chats = [];
                    if (window.Store.Chat.getModels) {
                        chats = window.Store.Chat.getModels();
                    } else if (window.Store.Chat._models) {
                        chats = window.Store.Chat._models;
                    } else {
                        return { success: false, error: 'No chat models found' };
                    }
                    
                    // Filter hanya group dan ambil hanya name dan id
                    const groups = chats
                        .filter(chat => chat && chat.id && (chat.id._serialized || chat.id).endsWith('@g.us'))
                        .map(chat => ({
                            id: chat.id._serialized || chat.id,
                            name: chat.formattedTitle || chat.name || 'Unknown Group'
                        }));
                    
                    return { 
                        success: true, 
                        data: groups,
                        count: groups.length,
                        source: 'Store.Chat'
                    };
                    
                } catch (error) {
                    return { success: false, error: error.message };
                }
            })();
        `;

        const result = await executeInWebView(script);
        
        if (result && result.success) {
            const groups = result.data || [];
            currentData.groups = groups;
            displayGroupsTable(groups);
            updateCount('groupsCount', groups.length);
            addStatusLog(`✅ Berhasil memuat ${groups.length} grup (${result.source})`);
            showNotification(`Berhasil memuat ${groups.length} grup`, 'success');
        } else {
            const errorMsg = result?.error || 'Unknown error';
            addStatusLog('❌ Gagal memuat grup: ' + errorMsg);
            showNotification('Gagal memuat grup', 'error');
        }

    } catch (error) {
        addStatusLog('❌ Gagal memuat grup: ' + error.message);
        showNotification('Error saat memuat grup', 'error');
    }
}

// ============================================================================
// DATA EXTRACTION - GROUPS MEMBERS (SIMPLIFIED VERSION)
// ============================================================================

async function extractSelectedMembers() {
    const selectedGroups = Array.from(currentData.selectedGroups);
    if (selectedGroups.length === 0) {
        showNotification('Pilih grup terlebih dahulu dengan mencentang checkbox.', 'warning');
        return;
    }

    showLoading('groupMembersTableBody', 'Memuat data member grup...');
    
    try {
        addStatusLog('👥 Memulai ekstraksi member grup...');
        
        let totalMembersExtracted = 0;
        const allMembers = [];

        for (const groupId of selectedGroups) {
            try {
                const group = currentData.groups.find(g => g.id === groupId);
                if (!group) {
                    addStatusLog(`❌ Group tidak ditemukan: ${groupId}`);
                    continue;
                }

                addStatusLog(`🔍 Mengekstrak member dari: ${group.name}`);
                
                const cleanGroupId = groupId.replace('@g.us', '');
                
                const script = `
                    (async function() {
                        try {
                            const groupId = "${cleanGroupId}";
                            const fullGroupId = groupId + "@g.us";

                            if (!window.Store || !window.Store.GroupMetadata) {
                                return { success: false, error: 'Store not ready' };
                            }

                            let group = window.Store.GroupMetadata.get(fullGroupId);

                            if (!group) {
                                try {
                                    group = await window.Store.GroupMetadata.find(fullGroupId);
                                } catch (err) {
                                    return { success: false, error: 'Failed to fetch group metadata' };
                                }
                            }

                            if (!group) {
                                return { success: false, error: 'Group not found' };
                            }

                            const participants = group.participants
                                .map(p => {
                                    try {
                                        const user = window.Store.LidUtils ? window.Store.LidUtils.getPhoneNumber(p.id) : null;
                                        return {
                                            id: p.id._serialized || p.id,
                                            number: user ? user.user : (p.id.user || p.id),
                                            name: p.name || p.notify || '',
                                            isAdmin: p.isAdmin || false
                                        };
                                    } catch (e) {
                                        return {
                                            id: p.id._serialized || p.id,
                                            number: p.id.user || p.id,
                                            name: p.name || p.notify || '',
                                            isAdmin: p.isAdmin || false
                                        };
                                    }
                                })
                                // FILTER: Hanya ambil yang berakhiran @c.us
                                .filter(p => p.id.endsWith('@c.us'));

                            return {
                                success: true,
                                groupId: fullGroupId,
                                groupName: "${group.name}",
                                participants: participants,
                                count: participants.length,
                                totalParticipants: group.participants.length // Total sebelum filter
                            };

                        } catch (error) {
                            return { success: false, error: error.message };
                        }
                    })();
                `;

                console.log(`🔄 Executing extraction script for group: ${group.name}`);
                const result = await executeInWebView(script);
                
                if (result && result.success) {
                    const members = result.participants.map(member => ({
                        number: member.number,
                        name: member.name,
                        memberOf: result.groupName,
                        isAdmin: member.isAdmin,
                        groupId: result.groupId
                    }));

                    allMembers.push(...members);
                    totalMembersExtracted += members.length;
                    
                    // Log dengan informasi filter
                    const filteredCount = result.totalParticipants - result.count;
                    addStatusLog(`✅ ${members.length} member (@c.us) berhasil diextract dari ${result.groupName} (${filteredCount} @lid difilter)`);
                    
                } else {
                    const errorMsg = result?.error || 'Unknown error occurred';
                    console.error(`❌ Failed to extract from ${group.name}:`, errorMsg);
                    addStatusLog(`❌ Gagal extract member dari ${group.name}: ${errorMsg}`);
                }

                // Delay untuk menghindari rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (groupError) {
                console.error(`❌ Error processing group ${groupId}:`, groupError);
                addStatusLog(`❌ Error process ${groupId}: ${groupError.message}`);
            }
        }

        // Final processing
        if (allMembers.length > 0) {
            currentData.groupMembers = allMembers;
            displayGroupMembersTable(allMembers);
            updateCount('groupMembersCount', allMembers.length);
            
            addStatusLog(`✅ Total ${allMembers.length} member (@c.us) berhasil diextract dari ${selectedGroups.length} grup`);
            showNotification(`Berhasil extract ${allMembers.length} member (@c.us) dari ${selectedGroups.length} grup`, 'success');
            
            // Auto switch ke group members tab
            setTimeout(() => {
                const groupMembersTab = document.querySelector('[data-group-subtab="group-members"]');
                if (groupMembersTab) {
                    groupMembersTab.click();
                    addStatusLog('📊 Data member grup (@c.us) telah ditampilkan');
                }
            }, 500);
            
        } else {
            addStatusLog('❌ Tidak ada member @c.us yang berhasil diextract dari grup yang dipilih');
            showNotification('Tidak ada member @c.us yang berhasil diextract', 'warning');
            displayGroupMembersTable([]);
        }

    } catch (error) {
        console.error('❌ Fatal error in extractSelectedMembers:', error);
        addStatusLog('❌ Gagal extract member: ' + error.message);
        showNotification('Error saat extract member', 'error');
        displayGroupMembersTable([]);
    }
}


async function exportGroupsToTarget() {
    if (currentData.groups.length === 0) {
        showNotification('Tidak ada data grup untuk diexport.', 'warning');
        return;
    }

    addStatusLog('🎯 Mengekspor grup ke Automation To Group...');

    const automationGroups = currentData.groups.map(group => ({
        id: group.id.replace('@g.us', ''),
        name: group.name,
        participantCount: group.participantCount || 0,
        status: 'Pending',
        source: 'Group List'
    }));

    const existingIds = new Set(currentData.sendingGroups.map(g => g.id));
    const newGroups = automationGroups.filter(group => !existingIds.has(group.id));

    if (newGroups.length > 0) {
        currentData.sendingGroups.push(...newGroups);
        displaySendingGroupsTable(currentData.sendingGroups);
        updateCount('sendingGroupsCount', currentData.sendingGroups.length);
        
        addStatusLog(`✅ ${newGroups.length} grup berhasil ditambahkan ke Automation To Group`);
        showNotification(`${newGroups.length} grup ditambahkan ke Automation`, 'success');
        
        switchMainTab('automation');
        setTimeout(() => {
            switchSubTab('automation', 'send-to-group');
        }, 500);
    } else {
        addStatusLog('ℹ️ Semua grup sudah ada di Automation To Group');
        showNotification('Semua grup sudah ada di Automation', 'info');
    }
}

function clearGroups() {
    if (currentData.groups.length === 0) {
        addStatusLog('ℹ️ Data grup sudah kosong');
        return;
    }

    if (confirm('Apakah Anda yakin ingin menghapus semua data grup?')) {
        currentData.groups = [];
        currentData.selectedGroups.clear();
        displayGroupsTable([]);
        updateCount('groupsCount', 0);
        addStatusLog('🗑️ Data grup berhasil dibersihkan');
        showNotification('Data grup dibersihkan', 'info');
    }
}

// ============================================================================
// GROUP MEMBERS MANAGEMENT
// ============================================================================

async function exportMembersToTarget() {
    if (currentData.groupMembers.length === 0) {
        showNotification('Tidak ada data member grup untuk diexport.', 'warning');
        return;
    }

    addStatusLog('🎯 Mengekspor member grup ke Automation To Contact...');

    const automationContacts = currentData.groupMembers.map(member => ({
        id: member.number,
        name: member.name || `Member ${member.number}`,
        number: member.number,
        status: 'Pending',
        source: `Group: ${member.memberOf}`,
        memberOf: member.memberOf,
        groupId: member.groupId,
        isAdmin: member.isAdmin || false,
        isSuperAdmin: member.isSuperAdmin || false,
        role: member.role || 'Member'
    }));

    const existingIds = new Set(currentData.sendingContacts.map(c => c.id));
    const newContacts = automationContacts.filter(contact => !existingIds.has(contact.id));

    if (newContacts.length > 0) {
        currentData.sendingContacts.push(...newContacts);
        displaySendingContactsTable(currentData.sendingContacts);
        updateCount('sendingContactsCount', currentData.sendingContacts.length);
        
        addStatusLog(`✅ ${newContacts.length} member grup berhasil ditambahkan ke Automation To Contact`);
        showNotification(`${newContacts.length} member grup ditambahkan ke Automation`, 'success');
        
        switchMainTab('automation');
    } else {
        addStatusLog('ℹ️ Semua member grup sudah ada di Automation To Contact');
        showNotification('Semua member grup sudah ada di Automation', 'info');
    }
}

async function saveGroupMembers() {
    if (currentData.groupMembers.length === 0) {
        showNotification('Tidak ada data member grup untuk disimpan.', 'warning');
        return;
    }

    addStatusLog('💾 Menyimpan data member grup ke CSV...');
    
    try {
        const csvContent = generateGroupMembersCSV(currentData.groupMembers);
        downloadCSV(csvContent, 'whatsapp-group-members');
        addStatusLog('✅ Data member grup berhasil disimpan');
        showNotification('Data member grup berhasil disimpan', 'success');
    } catch (error) {
        addStatusLog('❌ Gagal menyimpan data member grup: ' + error.message);
        showNotification('Gagal menyimpan data member grup', 'error');
    }
}

function clearGroupMembers() {
    if (currentData.groupMembers.length === 0) {
        addStatusLog('ℹ️ Data member grup sudah kosong');
        return;
    }

    if (confirm('Apakah Anda yakin ingin menghapus semua data member grup?')) {
        currentData.groupMembers = [];
        displayGroupMembersTable([]);
        updateCount('groupMembersCount', 0);
        addStatusLog('🗑️ Data member grup berhasil dibersihkan');
        showNotification('Data member grup dibersihkan', 'info');
    }
}

// ============================================================================
// CSV GENERATION FUNCTIONS
// ============================================================================

function generateContactsCSV(contacts) {
    const headers = ['Name', 'Phone Number', 'Push Name', 'Is Business', 'Is User', 'Is WA Contact', 'ID'];
    let csv = headers.join(',') + '\n';
    
    contacts.forEach(contact => {
        const row = [
            escapeCSV(contact.name || ''),
            escapeCSV(contact.number || ''),
            escapeCSV(contact.pushname || ''),
            contact.isBusiness ? 'Yes' : 'No',
            contact.isUser ? 'Yes' : 'No',
            contact.isWAContact ? 'Yes' : 'No',
            escapeCSV(contact.id || '')
        ];
        csv += row.join(',') + '\n';
    });
    
    return csv;
}

function generateChatContactsCSV(chatContacts) {
    const headers = ['Name', 'ID', 'Type', 'Unread Count', 'Participant Count', 'Timestamp', 'Is Read Only', 'Is Archived'];
    let csv = headers.join(',') + '\n';
    
    chatContacts.forEach(chat => {
        const row = [
            escapeCSV(chat.name || 'Unknown'),
            escapeCSV(chat.id || ''),
            chat.isGroup ? 'Group' : 'Contact',
            chat.unreadCount || 0,
            chat.participantCount || '',
            chat.timestamp || '',
            chat.isReadOnly ? 'Yes' : 'No',
            chat.isArchived ? 'Yes' : 'No'
        ];
        csv += row.join(',') + '\n';
    });
    
    return csv;
}

function generateGroupMembersCSV(groupMembers) {
    const headers = ['Name', 'Phone Number', 'Group Name', 'Group ID', 'Role', 'Is Admin', 'Is Super Admin'];
    let csv = headers.join(',') + '\n';
    
    groupMembers.forEach(member => {
        const row = [
            escapeCSV(member.name || 'Unknown'),
            escapeCSV(member.number || ''),
            escapeCSV(member.memberOf || ''),
            escapeCSV(member.groupId || ''),
            escapeCSV(member.role || 'Member'),
            member.isAdmin ? 'Yes' : 'No',
            member.isSuperAdmin ? 'Yes' : 'No'
        ];
        csv += row.join(',') + '\n';
    });
    
    return csv;
}

// ============================================================================
// TABLE DISPLAY FUNCTIONS
// ============================================================================

function displayContactsTable(contacts) {
    const tbody = document.getElementById('contactsTableBody');
    if (!tbody) return;
    
    if (!contacts || contacts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="2" class="px-4 py-8 text-center text-sm text-slate-500">
                    <i class="fas fa-inbox text-2xl text-slate-300 mb-2 block"></i>
                    Tidak ada kontak yang ditemukan
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    contacts.forEach(contact => {
        const businessBadge = contact.isBusiness ? 
            '<span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-2">Business</span>' : '';
        
        html += `
            <tr class="hover:bg-slate-50 transition-colors group">
                <td class="px-4 py-3 text-sm font-medium text-slate-900">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-8 w-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            ${contact.name ? contact.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div class="ml-3">
                            <div class="font-medium text-slate-900 flex items-center">
                                ${contact.name || 'Unknown'} ${businessBadge}
                            </div>
                            ${contact.pushname ? `<div class="text-xs text-slate-500">${contact.pushname}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-sm text-slate-900 font-mono ">${contact.number || contact.id}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function displayChatContactsTable(chatContacts) {
    const tbody = document.getElementById('chatContactsTableBody');
    if (!tbody) return;
    
    if (!chatContacts || chatContacts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="2" class="px-4 py-8 text-center text-sm text-slate-500">
                    <i class="fas fa-inbox text-2xl text-slate-300 mb-2 block"></i>
                    Tidak ada chat yang ditemukan
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    chatContacts.forEach(chat => {
        const isGroup = chat.type === "group";
        const icon = isGroup ? 'fa-users' : 'fa-user';
        const color = isGroup ? 'from-blue-500 to-cyan-500' : 'from-emerald-500 to-green-500';
        const typeBadge = isGroup ? 'Group' : 'Contact';
        const badgeColor = isGroup ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800';
        
        const unreadBadge = chat.unreadCount > 0 ? 
            `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 ml-2">${chat.unreadCount}</span>` : '';
        
        const archivedBadge = chat.isArchived ? 
            '<span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 ml-2">Archived</span>' : '';
        
        html += `
            <tr class="hover:bg-slate-50 transition-colors group">
                <td class="px-4 py-3 text-sm">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-8 w-8 bg-gradient-to-r ${color} rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="ml-3">
                            <div class="font-medium text-slate-900 flex items-center">
                                ${chat.id}
                                ${unreadBadge}
                                ${archivedBadge}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-sm">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor} border border-transparent">
                        <i class="fas ${icon} mr-1"></i>
                        ${typeBadge}
                    </span>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function displayGroupsTable(groups) {
    const tbody = document.getElementById('groupsTableBody');
    if (!tbody) return;
    
    if (!groups || groups.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="px-4 py-8 text-center text-sm text-slate-500">
                    <i class="fas fa-users text-2xl text-slate-300 mb-2 block"></i>
                    Tidak ada grup yang ditemukan
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    groups.forEach(group => {
        const isSelected = currentData.selectedGroups.has(group.id);
        const participantText = group.participantCount ? `${group.participantCount} members` : 'Unknown members';
        
        const archivedBadge = group.isArchived ? 
            '<span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 ml-2">Archived</span>' : '';
        
        const readonlyBadge = group.isReadOnly ? 
            '<span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 ml-2">Read Only</span>' : '';
        
        html += `
            <tr class="hover:bg-slate-50 transition-colors group ${isSelected ? 'bg-blue-50' : ''}">
                <td class="px-4 py-3 text-sm text-slate-900">
                    <input type="checkbox" onchange="toggleGroupSelection('${group.id}')"
                           ${isSelected ? 'checked' : ''}
                           class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-colors">
                </td>
                <td class="px-4 py-3 text-sm font-medium text-slate-900">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="ml-3">
                            <div class="font-medium text-slate-900 flex items-center">
                                ${group.name || 'Unknown Group'}
                                ${archivedBadge}
                                ${readonlyBadge}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-sm text-slate-900 font-mono">
                    ${group.id.length > 20 ? group.id.substring(0, 20) + '...' : group.id}
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function displayGroupMembersTable(groupMembers) {
    const tbody = document.getElementById('groupMembersTableBody');
    if (!tbody) return;
    
    if (!groupMembers || groupMembers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="2" class="px-4 py-8 text-center text-sm text-slate-500">
                    <i class="fas fa-user-friends text-2xl text-slate-300 mb-2 block"></i>
                    Tidak ada member grup yang ditemukan
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    groupMembers.forEach((member) => {
        let roleBadge = '';
        if (member.isSuperAdmin) {
            roleBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 ml-2 border border-purple-200">Super Admin</span>';
        } else if (member.isAdmin) {
            roleBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ml-2 border border-blue-200">Admin</span>';
        }
        
        html += `
            <tr class="hover:bg-slate-50 transition-colors group">
                <td class="px-4 py-3 text-sm">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-8 w-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            ${member.name ? member.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div class="ml-3">
                            <div class="font-medium text-slate-900 flex items-center">
                                ${member.name || 'Unknown'} ${roleBadge}
                            </div>
                            <div class="text-xs text-slate-500 font-mono mt-1">${member.number}</div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-sm text-slate-900">
                    <div class="flex flex-col">
                        <span class="text-sm font-medium">${member.memberOf || 'Unknown Group'}</span>
                        <span class="text-xs text-slate-500">${member.groupId ? member.groupId.replace('@g.us', '') : ''}</span>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// ============================================================================
// SELECTION FUNCTIONS
// ============================================================================

function toggleGroupSelection(groupId) {
    if (currentData.selectedGroups.has(groupId)) {
        currentData.selectedGroups.delete(groupId);
    } else {
        currentData.selectedGroups.add(groupId);
    }
    
    const checkbox = document.querySelector(`[onchange="toggleGroupSelection('${groupId}')"]`);
    if (checkbox) {
        checkbox.checked = currentData.selectedGroups.has(groupId);
    }
    
    updateSelectAllGroupsCheckbox();
}

function toggleSelectAllGroups() {
    const selectAll = document.getElementById('selectAllGroups');
    const checkboxes = document.querySelectorAll('#groupsTableBody input[type="checkbox"]');
    
    if (selectAll.checked) {
        currentData.groups.forEach(group => {
            currentData.selectedGroups.add(group.id);
        });
    } else {
        currentData.selectedGroups.clear();
    }
    
    checkboxes.forEach(checkbox => {
        const groupId = checkbox.getAttribute('onchange').match(/'([^']+)'/)[1];
        checkbox.checked = currentData.selectedGroups.has(groupId);
    });
}

function updateSelectAllGroupsCheckbox() {
    const selectAll = document.getElementById('selectAllGroups');
    if (selectAll) {
        const totalGroups = currentData.groups.length;
        const selectedGroups = currentData.selectedGroups.size;
        selectAll.checked = totalGroups > 0 && selectedGroups === totalGroups;
        selectAll.indeterminate = totalGroups > 0 && selectedGroups > 0 && selectedGroups < totalGroups;
    }
}

// ============================================================================
// EXPORT FUNCTIONS TO WINDOW OBJECT
// ============================================================================

window.loadContacts = loadContacts;
window.saveContacts = saveContacts;
window.exportContactsToTarget = exportContactsToTarget;
window.clearContacts = clearContacts;

window.loadChatContacts = loadChatContacts;
window.saveChatContacts = saveChatContacts;
window.exportChatContactsToTarget = exportChatContactsToTarget;
window.clearChatContacts = clearChatContacts;

window.loadGroups = loadGroups;
window.extractSelectedMembers = extractSelectedMembers;
window.exportGroupsToTarget = exportGroupsToTarget;
window.clearGroups = clearGroups;

window.exportMembersToTarget = exportMembersToTarget;
window.saveGroupMembers = saveGroupMembers;
window.clearGroupMembers = clearGroupMembers;

window.toggleGroupSelection = toggleGroupSelection;
window.toggleSelectAllGroups = toggleSelectAllGroups;

console.log('✅ WhatsApp Blaze extractor functions loaded successfully');