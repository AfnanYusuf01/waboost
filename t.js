  (async function() {
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
  })();