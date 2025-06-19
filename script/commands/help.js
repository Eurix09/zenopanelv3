const eurix = {
    name: "help",
    description: "Shows the command list and descriptions",
    usage: "/help [page_number | all]",
};

async function execute(bot, msg, args) {
    const chatId = msg.chat.id;
    try {
        const commandsPath = process.cwd() + "/script/commands";
        const { readdirSync } = require("fs");
        const commandFiles = readdirSync(commandsPath).filter((file) =>
            file.endsWith(".js"),
        );

        const commands = commandFiles.map((file) => {
            const command = require(`${commandsPath}/${file}`);
            return command.eurix || {};
        });

        const commandsPerPage = 5;
        let startIndex = 0;
        let endIndex = commandsPerPage;
        let totalPages = Math.ceil(commands.length / commandsPerPage);
        let page = 1;
        let showPhoto = true;

        if (args.length > 0) {
            if (args[0].toLowerCase() === "all") {
                startIndex = 0;
                endIndex = commands.length;
                page = 1;
                totalPages = 1;
                showPhoto = false;
            } else if (!isNaN(args[0])) {
                page = Math.max(1, parseInt(args[0]));
                if (page > totalPages) page = totalPages;
                startIndex = (page - 1) * commandsPerPage;
                endIndex = startIndex + commandsPerPage;
            }
        }

        const commandList = commands
            .slice(startIndex, endIndex)
            .map((cmd) => {
                let cmdText = `/${cmd.name}`;
                if (cmd.description) {
                    cmdText += ` - _${cmd.description}_`;
                }
                if (cmd.permission) {
                    cmdText += `\n  Permission: \`${cmd.permission}\``;
                }
                if (cmd.usage) {
                    cmdText += `\n  Usage: \`${cmd.usage}\``;
                }
                return cmdText;
            })
            .join("\n\n");

        const helpMessage =
            `👥 *Available Commands (Page ${page}/${totalPages}):*\n\n` +
            `${commandList}\n\n` +
            `Use */help <page_number>* to view more commands.\n` +
            `Avail Cheat? [Contact my owner](https://t.me/ZenoOnTop)`;

        if (showPhoto) {
            const botInfo = await bot.getMe();
            const botId = botInfo.id;

            const photos = await bot.getUserProfilePhotos(botId);

            if (photos && photos.total_count > 0) {
                const fileId = photos.photos[0][0].file_id;
                await bot.sendPhoto(chatId, fileId, {
                    caption: helpMessage,
                    parse_mode: "Markdown",
                });
                return;
            }
        }

        await bot.sendMessage(chatId, helpMessage, {
            parse_mode: "Markdown",
        });
    } catch (error) {
        console.error("Help command error:", error);
        await bot.sendMessage(
            chatId,
            "❌ *An error occurred while fetching commands.*",
            { parse_mode: "Markdown" },
        );
    }
}

module.exports = { eurix, execute };
