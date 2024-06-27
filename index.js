const { Client, Intents, MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton, Permissions } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { token, clientId, guildId, channelId, staffRoleId, categories } = require('./config.json');

const commands = [
  {
    name: 'add',
    description: 'Ajouter un utilisateur à un ticket',
    options: [
      {
        name: 'user',
        type: 6,
        description: 'le membre à ajouter',
        required: true,
      },
    ],
  },
  {
    name: 'remove',
    description: 'Retirer un utilisateur d\'un ticket',
    options: [
      {
        name: 'user',
        type: 6,
        description: 'Le membre à retirer',
        required: true,
      },
    ],
  },
  {
    name: 'rename',
    description: 'Rename un ticket',
    options: [
      {
        name: 'new_name',
        type: 3, 
        description: 'Nouveau nom pour le ticket',
        required: true,
      },
    ],
  },
];
const rest = new REST({ version: '9' }).setToken(token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const openTickets = new Map();

client.once('ready', async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
  
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return console.error("Guild non trouvée");

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return console.error("Channel non trouvé");

  const messages = await channel.messages.fetch();
  await channel.bulkDelete(messages);

  const embed = new MessageEmbed()
    .setAuthor(client.user.username, client.user.displayAvatarURL())
    .setTitle('📩 Ouvrir un ticket')
    .setColor('#2AFF00')
    .setDescription('Merci de fournir le plus d\'information possible dans votre ticket pour un meilleur traitement par notre Equipe de Staff !\n__Pour ouvrir un ticket, tu dois choisir la catégorie qui concerne ta demande.__\n\n📝 - **Question**: Pour toutes question en générales.\n⚠ - **Problème En Jeu**: Pour un problème sur une scène, avec un joueur ou avec le serveur.\n🛒 - **Boutique**: Pour un achat boutique, une question sur la boutique, une réduction, etc...\n💰 - **Remboursement**: Pour un remboursement lié à un problème du serveur.\n🔨 - **Unban/Unjail**: Pour faire une demande d\'Unban ou d\'Unjail.\n📗 - **Légal**: Pour contacter l\'équipe Légal. (Déposer un dossier d\'entreprise.)\n🔪 - **Illégal**: Pour contacter l\'équipe Illégal. (Déposer un dossier illégal, faire une attaque de territoires, question sur l\'illégal, etc...)\n⌛ - **Wipe/Skin/Mort RP**: Pour recommencer un personnage à 0, demander de refaire l\'esthétique suite à un problème ou faire un dossier de Mort RP contre un joueur.\n📍 - **Administrateurs/Superviseurs**: Pour contacter l\'Equipe Administrateurs/Superviseurs.\n📌 - **Staff**: Pour contacter l\'Equipe de Gestion Staff. (Une fois que vous avez déposer votre candidature, Faire une plainte, etc...)\n🎉 - **Event**: Pour contacter l\'Equipe Evènementiel. (Organiser un Evènement ou autre...)\n💻 - **Développeur**: Pour contacter l\'Equipe de Développeur. (Remonter un bug ou autres...)')
    .setFooter(new Date().toLocaleString());

  const row = new MessageActionRow()
    .addComponents(
      new MessageSelectMenu()
        .setCustomId('select')
        .setPlaceholder('Choisissez une catégorie de ticket')
        .addOptions([
          { label: '📝 Question', value: 'question' },
          { label: '⚠ Problème En Jeu', value: 'probleme_en_jeu' },
          { label: '🛒 Boutique', value: 'boutique' },
          { label: '💰 Remboursement', value: 'remboursement' },
          { label: '🔨 Unban/Unjail', value: 'unban_unjail' },
          { label: '📗 Légal', value: 'legal' },
          { label: '🔪 Illégal', value: 'illegal' },
          { label: '⌛ Wipe/Skin/Mort RP', value: 'wipe_skin_mort_rp' },
          { label: '📍 Administrateurs/Superviseurs', value: 'administrateurs_superviseurs' },
          { label: '📌 Staff', value: 'staff' },
          { label: '🎉 Event', value: 'event' },
          { label: '💻 Développeur', value: 'developpeur' },
        ]),
    );

  await channel.send({ embeds: [embed], components: [row] });

  console.log('Embed et select menu envoyés');

  updateBotStatus();
});

client.on('interactionCreate', async interaction => {
  if (interaction.isSelectMenu()) {
    const selectedCategory = interaction.values[0];
    const category = categories[selectedCategory];
    if (!category) return interaction.reply({ content: 'Catégorie invalide!', ephemeral: true });

    const channelName = `${selectedCategory} - ${interaction.user.username}`;
    const ticketChannel = await interaction.guild.channels.create(channelName, {
      type: 'GUILD_TEXT',
      parent: category,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: ['VIEW_CHANNEL'],
        },
        {
          id: interaction.user.id,
          allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
        },
        {
          id: staffRoleId,
          allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
        },
      ],
    });

    openTickets.set(ticketChannel.id, ticketChannel);

    updateBotStatus();

    await ticketChannel.send(`Ticket créé par ${interaction.user} / ${interaction.user.tag}`);

    const closeRow = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setCustomId('close_ticket')
          .setLabel('Fermer le ticket')
          .setStyle('DANGER')
      );

    const ticketEmbed = new MessageEmbed()
      .setColor('#2AFF00')
      .addField('Informations', 'Veuillez préciser votre demande auprès de l\'équipe de **kShop**')
      .addField('Support', 'Une réponse/aide vous sera apportée sous __72h maximum__ (Jours ouvrés) sauf exception.')
      .addField('Type de Ticket', selectedCategory)
      .setFooter(`⭐ kShop ${new Date().toLocaleDateString()}`)
      .setThumbnail(interaction.user.displayAvatarURL());

    await ticketChannel.send({ embeds: [ticketEmbed], components: [closeRow] });

    await interaction.reply({ content: `Ticket créé : ${ticketChannel}`, ephemeral: true });
  } else if (interaction.isButton()) {
    if (interaction.customId === 'close_ticket') {
      const ticketChannel = interaction.channel;
      await interaction.reply('Le ticket sera fermé dans 10 secondes...');
      setTimeout(async () => {
        openTickets.delete(ticketChannel.id);
        updateBotStatus();
        await ticketChannel.delete();
      }, 10000);
    }
  } else if (interaction.isCommand()) {
    const command = interaction.commandName.toLowerCase();
    const args = interaction.options;

    if (command === 'add') {
      const ticketChannel = interaction.channel;
      const userToAdd = interaction.options.getUser('user'); // Fetch the user directly from interaction.options
    
      if (!openTickets.has(ticketChannel.id)) {
        return interaction.reply({ content: 'Ce n\'est pas un ticket ouvert!', ephemeral: true });
      }
    
      if (!ticketChannel.permissionsFor(interaction.member).has(Permissions.FLAGS.MANAGE_CHANNELS)) {
        return interaction.reply({ content: 'Vous n\'avez pas la permission d\'ajouter des membres à ce ticket!', ephemeral: true });
      }
    
      const existingPermission = ticketChannel.permissionOverwrites.cache.find(p => p.id === userToAdd.id);
      if (existingPermission) {
        return interaction.reply({ content: 'Cet utilisateur est déjà ajouté au ticket!', ephemeral: true });
      }
    
      try {
        await ticketChannel.permissionOverwrites.edit(userToAdd.id, {
          VIEW_CHANNEL: true,
          SEND_MESSAGES: true
        });
    
        interaction.reply({ content: `Utilisateur ajouté au ticket: ${userToAdd}`, ephemeral: true });
      } catch (error) {
        console.error('Error editing permission overwrites:', error);
        interaction.reply({ content: 'Une erreur est survenue lors de l\'ajout de l\'utilisateur au ticket.', ephemeral: true });
      }

    
    
    } else if (command === 'remove') {
      const ticketChannel = interaction.channel;
      const userToRemove = args.getUser('user');

      if (!openTickets.has(ticketChannel.id)) {
        return interaction.reply({ content: 'Ce n\'est pas un ticket ouvert!', ephemeral: true });
      }

      if (!ticketChannel.permissionsFor(interaction.member).has(Permissions.FLAGS.MANAGE_CHANNELS)) {
        return interaction.reply({ content: 'Vous n\'avez pas la permission de retirer des membres de ce ticket!', ephemeral: true });
      }

      if (interaction.user.id === userToRemove.id) {
        return interaction.reply({ content: 'Vous ne pouvez pas vous retirer du ticket!', ephemeral: true });
      }

      await ticketChannel.permissionOverwrites.delete(userToRemove.id);

      interaction.reply({ content: `Utilisateur retiré du ticket: ${userToRemove}`, ephemeral: true });
    } else if (command === 'rename') {
      const ticketChannel = interaction.channel;
      const newName = args.getString('new_name');

      if (!openTickets.has(ticketChannel.id)) {
        return interaction.reply({ content: 'Ce n\'est pas un ticket ouvert!', ephemeral: true });
      }

      if (!ticketChannel.permissionsFor(interaction.member).has(Permissions.FLAGS.MANAGE_CHANNELS)) {
        return interaction.reply({ content: 'Vous n\'avez pas la permission de renommer ce ticket!', ephemeral: true });
      }

      await ticketChannel.setName(newName);

      interaction.reply({ content: `Le ticket a été rename en "${newName}"`, ephemeral: true });
    }
  }
});

function updateBotStatus() {
  const ticketCount = openTickets.size;
  client.user.setActivity(`${ticketCount} ticket${ticketCount !== 1 ? 's' : ''} ouvert${ticketCount !== 1 ? 's' : ''}`, { type: 'WATCHING' });
}

client.login(token);
