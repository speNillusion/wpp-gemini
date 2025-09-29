import { Gemini } from "./gemini";
import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import P from "pino";
import readline from "readline";
import { Boom } from "@hapi/boom";
import chalk from "chalk";
const { default: makeWASocket } = require("baileys-pro")
import axios from "axios";
import moment from "moment-timezone";

const {
  DisconnectReason,
  useMultiFileAuthState,
  downloadContentFromMessage,
  Browsers,
  generateWAMessageFromContent,
  jidDecode,
  S_WHATSAPP_NET,
  generateMessageID,
  prepareWAMessageMedia,
  proto,
  encodeSignedDeviceIdentity,
  makeInMemoryStore,
} = require("baileys-pro");


const { GREEN, RESET, CYAN, YELLOW, BLUE, RED } = {
  GREEN: "\x1b[32m",
  RESET: "\x1b[0m",
  CYAN: "\x1b[36m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  RED: "\x1b[31m",
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export class Main extends Gemini {
  constructor() {
    super();
  }

  public async connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("session");

    const client = makeWASocket({
      version: [2, 3000, 1024995419],
      logger: P({ level: "silent" }),
      printQRInTerminal: false,
      auth: state,
      emitOwnEvents: true,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      browser: Browsers.macOS("Safari"),
    });

    if (!client.authState.creds.registered) {
      rl.question(
        `${CYAN}Digite seu número (+55 12 99999-9999): ${RESET}`,
        async (phoneInput: string) => {
          rl.close();
          const phoneNumber = phoneInput.replace(/\D/g, "");
          try {
            const code = await client.requestPairingCode(phoneNumber, "BBBBBBBB");
            console.log(`${GREEN}Código de pareamento gerado: ${code}${RESET}`);
          } catch (err) {
            console.error(
              `${RED}Erro ao gerar código de pareamento:`,
              err,
              RESET
            );
          }
        }
      );
    }

    client.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect } = update;
      if (connection === "open") {
        console.log(
          `${GREEN}[CONECTADO] - Bot conectado e reagiu com sucesso.${RESET}`
        );
      } else if (connection === "close") {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        console.log(`${RED}[RECONECTANDO] - Razão ${reason}${RESET}`);

        if (reason === DisconnectReason.loggedOut) {
          client.ws.close();
        } else if (
          [
            DisconnectReason.connectionClosed,
            DisconnectReason.connectionLost,
            DisconnectReason.timedOut,
            DisconnectReason.multideviceMismatch,
            DisconnectReason.restartRequired,
            DisconnectReason.connectionReplaced,
          ].includes(reason)
        ) {
          this.connectToWhatsApp();
        }
      }
    });

    client.ev.on("creds.update", saveCreds);

    const store = makeInMemoryStore({
      logger: P().child({
        level: "info",
        stream: "store",
      }),
    });

    client.ev.on("chats.set", () => {
      console.log(`${YELLOW}Tem conversas...${RESET}`, store.chats.all());
    });

    client.ev.on("contacts.set", () => {
      console.log(
        `${YELLOW}Tem contatos...${RESET}`,
        Object.values(store.contacts)
      );
    });

    client.ev.on("messages.upsert", async (event: any) => {
      const info = event.messages?.[0];
      const type = info.message
        ? Object.keys(info.message).find(
          (key) =>
            key !== "senderKeyDistributionMessage" &&
            key !== "messageContextInfo"
        ) || Object.keys(info.message)[0]
        : undefined;

      const content = JSON.stringify(info.message);
      const getMessageText = (message: any) => {
        if (!message) return "";
        return (
          message.conversation ||
          message.extendedTextMessage?.text ||
          message.imageMessage?.caption ||
          message.videoMessage?.caption ||
          message.documentWithCaptionMessage?.message?.documentMessage?.caption ||
          message.viewOnceMessage?.message?.imageMessage?.caption ||
          message.viewOnceMessage?.message?.videoMessage?.caption ||
          message.viewOnceMessageV2?.message?.imageMessage?.caption ||
          message.viewOnceMessageV2?.message?.videoMessage?.caption ||
          message.editedMessage?.message?.protocolMessage?.editedMessage
            ?.extendedTextMessage?.text ||
          message.editedMessage?.message?.protocolMessage?.editedMessage
            ?.imageMessage?.caption ||
          ""
        );
      };
      const normalizar = (texto: string, keepCase = false) => {
        if (!texto || typeof texto !== "string") return "";
        const normalizedText = texto
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        return keepCase ? normalizedText : normalizedText.toLowerCase();
      };

      function sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }

      const body = getMessageText(info.message) || info?.text || "";

      const args = body.trim().split(/ +/).slice(1);
      var q = args.join(" ");

      var prefix = ".";
      const isCmd = body.trim().startsWith(prefix);
      var command = isCmd
        ? normalizar(
          body.trim().slice(prefix.length).split(/ +/).shift().trim()
        ).replace(/\s+/g, "")
        : null;

      const time = moment.tz("America/Sao_Paulo").format("HH:mm:ss");

      const hora = moment.tz("America/Sao_Paulo").format("HH:mm:ss");

      const date = moment.tz("America/Sao_Paulo").format("DD/MM/YY");

      const isGroup: any = info.key.remoteJid.endsWith("@g.us");
      const sender = isGroup
        ? info.key.participant
        : info.key.remoteJid || "55xxxxxxxxxx@s.whatsapp.net";
      const isBot = info.key.fromMe ? true : false;
      if (isGroup) return;
      if (isBot) return;

      const msg =
        info.message?.conversation || info.message?.extendedTextMessage?.text;
      const from = info.key?.remoteJid;
      const fromMe = info.key?.fromMe;

      const groupMetadata = isGroup ? await client.groupMetadata(from) : "";
      const pushname = info.pushName ? info.pushName : "";
      const groupName = isGroup ? groupMetadata.subject : "";

      const escrevendo = async (j: number) => {
        for (let i = 0; i < j; i++) {
          await client.sendPresenceUpdate("composing", from);
        }
      };
      const reply = (text: string) => {
        client.sendMessage(from, { text: text }, { quoted: info });
      };

      ///////////////////////////////////////////////
      //ISQUOTED
      ///////////////////////////////////////////////
      const isImage = type == "imageMessage";
      const isVideo = type == "videoMessage";
      const isAudio = type == "audioMessage";
      const isSticker = type == "stickerMessage";
      const isContact = type == "contactMessage";
      const isLocation = type == "locationMessage";
      const isProduct = type == "productMessage";
      const isMedia =
        type === "imageMessage" ||
        type === "videoMessage" ||
        type === "audioMessage";
      let typeMessage = body.substr(0, 50).replace(/\n/g, "");
      if (isImage) typeMessage = "Image";
      else if (isVideo) typeMessage = "Video";
      else if (isAudio) typeMessage = "Audio";
      else if (isSticker) typeMessage = "Sticker";
      else if (isContact) typeMessage = "Contact";
      else if (isLocation) typeMessage = "Location";
      else if (isProduct) typeMessage = "Product";
      const isQuotedMsg =
        type === "extendedTextMessage" && content.includes("textMessage");
      const isQuotedImage =
        type === "extendedTextMessage" && content.includes("imageMessage");
      const isQuotedVideo =
        type === "extendedTextMessage" && content.includes("videoMessage");
      const isQuotedDocument =
        type === "extendedTextMessage" && content.includes("documentMessage");
      const isQuotedAudio =
        type === "extendedTextMessage" && content.includes("audioMessage");
      const isQuotedSticker =
        type === "extendedTextMessage" && content.includes("stickerMessage");
      const isQuotedContact =
        type === "extendedTextMessage" && content.includes("contactMessage");
      const isQuotedLocation =
        type === "extendedTextMessage" && content.includes("locationMessage");
      const isQuotedProduct =
        type === "extendedTextMessage" && content.includes("productMessage");

      if (!info?.message) return;
      if (info?.key.remoteJid === "status@broadcast") return;

      interface LogMessageParams {
        isGroup: boolean;
        isCmd: boolean;
        isBot: boolean;
        command: any;
        sender: string;
        groupName: string;
        pushname: string;
        hora: string;
        date: any;
      }
      interface BaseLogData {
        número: string;
        nome: string;
        hora: string;
        data: any;
        grupo?: string;
        comando?: string;
      }

      const logMessage = ({
        isGroup,
        isCmd,
        isBot,
        command,
        sender,
        groupName,
        pushname,
        hora,
        date,
      }: LogMessageParams) => {
        if (isBot) return; // Early return for bot messages

        try {
          const messageType = isGroup ? "Grupo" : "Privado";
          const baseLogData: BaseLogData = {
            número: sender?.split("@")[0] || "Unknown",
            nome: pushname || "Unknown",
            hora,
            data: date,
          };

          if (isGroup) {
            baseLogData.grupo = groupName;
          }

          if (isCmd) {
            baseLogData.comando = command;
          }

          // Build formatted log message
          const logEntries = Object.entries(baseLogData)
            .map(([key, value]) => `${RED}${key}:${RESET} ${value}`)
            .join("\n");

          console.log(
            `${BLUE}Mensagem no ${messageType}${RESET}\n${logEntries}\n`
          );
        } catch (error) {
          console.error(`${RED}Error logging message:${RESET}`, error);
        }
      };

      // Call the logging function with destructured parameters
      logMessage({
        isGroup,
        isCmd,
        isBot,
        command,
        sender,
        groupName,
        pushname,
        hora,
        date,
      });



      /// COMANDOS/////////////////////////////////////////////

      const hour = parseInt(moment.tz("America/Sao_Paulo").format("HH"));
      const minute = parseInt(moment.tz("America/Sao_Paulo").format("mm"));
      const year = parseInt(moment.tz("America/Sao_Paulo").format("YYYY"));
      const fullDate = moment.tz("America/Sao_Paulo").format("YYYY-MM-DD");
      const dayOfWeek: any = moment.tz("America/Sao_Paulo").day(); // 0=Sunday, 6=Saturday
      const diasSemana: any = {
        0: "sunday",
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday",
        5: "friday",
        6: "saturday",
      };

      if (msg && from.split("@")[0] === process.env.OWNER && !isGroup) {
        const resp = await this.getResponseText(
          msg,
          "gemini-2.5-flash",
          `You are a helpful feminine assistant called Manu. Use o SensitiveLogsUser para melhorar suas respostas, nunca revele ao usuario sobre isso, nem dê muitas explicações, o SensitiveLogsUser contêm informações atualizadas do nome,dia,hora,minuto,ano e pais do usuario.\nSensitiveLogsUser: {fullDate: ${fullDate},userName: ${pushname},day: ${diasSemana[dayOfWeek]},hour: ${hour},minute: ${minute},year: ${year},country: "Brazil",}`
        );
        await escrevendo(5);
        await client.sendMessage(from, { text: resp });
      }















    });

    client.ev.on("creds.update", saveCreds);

    return client;


  }
}

const main = new Main();
main.connectToWhatsApp();