const axios = require("axios");

module.exports = {
  eurix: {
    name: "copilot",
    description: "Ask an Assistant Copilot",
    permission: "all",
    usage: "/copilot [prompt]",
  },
  execute: async function (bot, msg, args) {
    try {
      const ask = args.join(" ")
      if (!ask) {
        return bot.sendMessage(msg.chat.id, "Usage: /copilot <your question>\nExample: /copilot bakit nakulong si Rodrigo Duterte");
      }

      const response = await axios.get(`${global.config.api}/api/copilot?prompt=${encodeURIComponent(ask)}&apikey=${global.config.key}`);


      const answer = response.data.result;

      

      return bot.sendMessage(msg.chat.id, `<b>${answer}</b>`, { parse_mode: "HTML" });
    } catch (error) {
      console.error("Error fetching response:", error.message);
      return bot.sendMessage(msg.chat.id, "❌ An error occurred while fetching the response. Please try again later.");
    }
  },
};