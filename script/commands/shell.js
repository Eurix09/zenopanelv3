const { exec } = require("child_process");

const eurix = {
  name: "shell",
  permission: "admin",
  usage: "/shell [command]"
};

async function execute(bot, msg, args) {
  try {


    if (!args.length) {
      return bot.sendMessage(msg.chat.id, "❌ Please provide a command to execute.\n\nExample: `/shell uptime`", {
        parse_mode: "Markdown",
      });
    }

    const command = args.join(" ");

    exec(command, { timeout: 5000, shell: "/bin/bash" }, (error, stdout, stderr) => {
      if (error) {
        return bot.sendMessage(msg.chat.id, `❌ *Error:*\n\`${error.message}\``, { parse_mode: "Markdown" });
      }
      if (stderr) {
        return bot.sendMessage(msg.chat.id, `⚠️ *stderr:*\n\`${stderr}\``, { parse_mode: "Markdown" });
      }

      // Limit output length to prevent spamming
      const output = stdout.trim() || "✅ Command executed successfully, but no output.";
      const formattedOutput = output.length > 4000 ? `${output.slice(0, 4000)}...\n\n⚠️ Output truncated.` : output;

      bot.sendMessage(msg.chat.id, `✅ *Output:*\n\`\`\`\n${formattedOutput}\n\`\`\``, { parse_mode: "Markdown" });
    });
  } catch (error) {
    bot.sendMessage(msg.chat.id, `❌ Unexpected error: \`${error.message}\``, { parse_mode: "Markdown" });
  }
}

module.exports = {
  eurix,
  execute,
};