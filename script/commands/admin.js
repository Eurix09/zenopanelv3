const fs = require('fs');
const path = require('path');
const config = require('../../config.json');

module.exports = {
  eurix: {
    name: "admin",
    description: "Manage bot administrators",
    permission: "admin",
    usage: "/admin [action] [parameters]"
  },

  execute: async function(bot, msg, args) {
    const senderId = msg.from.id.toString();

    if (!args.length) {
      return bot.sendMessage(msg.chat.id, "Usage: /admin [ add | remove | list ]");
    }

    const subCommand = args[0].toLowerCase();

    if (subCommand === "add") {
      if (senderId !== config.admin[0]) {
        return bot.sendMessage(msg.chat.id, "⚠️ Only the system owner can add new admins.");
      }

      const newAdminId = args[1];
      if (!newAdminId) {
        return bot.sendMessage(msg.chat.id, "Please provide the Telegram ID of the new admin.");
      }

      if (config.admin.includes(newAdminId)) {
        return bot.sendMessage(msg.chat.id, "This user is already an admin.");
      }

      config.admin.push(newAdminId);
      fs.writeFileSync(path.join(__dirname, '../../config.json'), JSON.stringify(config, null, 2));
      return bot.sendMessage(msg.chat.id, `✅ Added ${newAdminId} as admin.`);
    }

    else if (subCommand === "remove") {
      if (senderId !== config.admin[0]) {
        return bot.sendMessage(msg.chat.id, "⚠️ Only the system owner can remove admins.");
      }

      const removeId = args[1];
      if (!removeId) {
        return bot.sendMessage(msg.chat.id, "Please provide the Telegram ID to remove.");
      }

      if (removeId === config.admin[0]) {
        return bot.sendMessage(msg.chat.id, "⚠️ Cannot remove the system owner.");
      }

      const index = config.admin.indexOf(removeId);
      if (index === -1) {
        return bot.sendMessage(msg.chat.id, "This user is not an admin.");
      }

      config.admin.splice(index, 1);
      fs.writeFileSync(path.join(__dirname, '../../config.json'), JSON.stringify(config, null, 2));
      return bot.sendMessage(msg.chat.id, `✅ Removed ${removeId} from admin list.`);
    }

    else if (subCommand === "list") {
      const adminList = config.admin.map((id, index) => 
        `${index + 1}. ${id}${id === config.admin[0] ? ' (Owner)' : ''}`
      ).join('\n');
      return bot.sendMessage(msg.chat.id, `📝 Admin List:\n${adminList}`);
    }

    else {
      return bot.sendMessage(msg.chat.id, "Invalid subcommand. Use: /admin [ add | remove | list ]");
    }
  }
};