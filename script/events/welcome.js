const moment = require('moment');
const axios = require('axios'); 

module.exports = {
  name: 'welcome',
  execute: async (bot, msg) => {
    const chatId = msg.chat.id;
    const newMembers = msg.new_chat_members;

    try {
      if (!newMembers) return;

      // Get bot info
      const botInfo = await bot.getMe();
      const chatInfo = await bot.getChat(chatId);
      const title = chatInfo.title || "the group";

      // Check if bot was added
      const isBotAdded = newMembers.some(member => member.id === botInfo.id);

      // If the bot itself is newly added
      if (isBotAdded) {
        const chatMember = await bot.getChatMember(chatId, botInfo.id);

        if (chatMember.status !== 'administrator') {
          await bot.sendMessage(
            chatId,
            `🎉 <b>${botInfo.first_name}</b> has been successfully connected!\n\n` +
            `Thank you for inviting me to <b>${title}</b>.`,
            { parse_mode: 'HTML' }
          );
        }
        return;
      }

      // Handle regular member joins
      for (const newMember of newMembers) {
        const memberName = `${newMember.first_name}${newMember.last_name ? ' ' + newMember.last_name : ''}`;
        const memberCount = await bot.getChatMemberCount(chatId);

        try {
          const response = await axios.get("https://shoti.fbbot.org/api/get-shoti");

          if (response.data && response.data.result.content) {
            await bot.sendVideo(chatId, response.data.result.content, {
              caption: `Hi <b>${memberName}</b>, welcome to <b>${title}</b>! 🥳<i>♥</i>\nYou are the <b>${memberCount}th</b> member.`,
              parse_mode: 'HTML'
            });
          } else {
            await bot.sendMessage(
              chatId,
              `Hi <b>${memberName}</b>, welcome to <b>${title}</b>!\n` +
              `Please enjoy your time here! 🥳<i>♥</i>\n\n` +
              `You are the <b>${memberCount}th</b> member of this group.`,
              { parse_mode: 'HTML' }
            );
          }
        } catch (shotiError) {
          console.error('Error fetching Shoti video:', shotiError);
          await bot.sendMessage(
            chatId,
            `Hi <b>${memberName}</b>, welcome to <b>${title}</b>!\n` +
            `Please enjoy your time here! 🥳<i>♥</i>\n\n` +
            `You are the <b>${memberCount}th</b> member of this group.`,
            { parse_mode: 'HTML' }
          );
        }
      }

    } catch (error) {
      console.log('Error in welcome handler:', error);
    }
  }
};