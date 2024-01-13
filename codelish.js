process.removeAllListeners("warning");

const fs = require("fs");
const crypto = require("crypto");
const readline = require("readline");
const arg2 = process.argv[2];
const password = "axo";
const log = console.log;
const help = `Codelish v1.0.0
--token=your_api_token
--session=your_session_token
--id=your_conversation_id (Only needed when using session token)
--use=session or token
--api-model=model_name (Default: gpt-3.5-turbo)
--session-model=model_name (Default: text-davinci-002-render-sha)
--help to get help
--setup Get started!
--readable output code converted to a format codelish understands. code is not executed

You can also use "--set-" at the start instead of "--" like "--set-token="
`;

if (!arg2) {
  log("\x1b[31m[x] Provide a file name.\x1b[39m");
  process.exit(1);
}

const sets = parseArgs(process.argv);

switch (true) {
  case "token" in sets:
    addToSaveEncrypted("token", sets["token"]);
    success();
    break;

  case "session" in sets:
    addToSaveEncrypted("session", sets["session"]);
    success();
    break;

  case "use" in sets:
    if (sets["use"] === "token") {
      addToSave("use", "token");
    } else {
      addToSave("use", "session");
    }
    success();
    break;

  case "id" in sets:
    addToSaveEncrypted("id", sets["id"]);
    success();
    break;

  case "readable" in sets:
    try {
      const fileData = fs.readFileSync(arg2, "utf8");
      log(generate(fileData));
    } catch (err) {
      console.error("\x1b[31m[x] File does not exist!\x1b[39m");
      process.exit(1);
    }
    break;

  case "session-model" in sets:
    addToSave("session_model", sets["session-model"]);
    break;

  case "api-model" in sets:
    addToSave("api_model", sets["api-model"]);
    break;

  case "setup" in sets:
    setup();
    break;

  case "help" in sets:
    log(help);
    break;

  default:
    break;
}

if (!arg2.startsWith("--") && !("readable" in sets)) {
  generateCode();
}

function generateCode() {
  try {
    const fileData = fs.readFileSync(arg2, "utf8");
    run(generate(fileData));
  } catch (err) {
    console.error("\x1b[31m[x] File does not exist!\x1b[39m");
    process.exit(1);
  }
}

function parseArgs(args) {
  const parsedArgs = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      if (key && value) {
        parsedArgs[key.replace("set-", "")] = value;
      } else {
        parsedArgs[key.replace("set-", "")] = "true";
      }
    }
  }
  return parsedArgs;
}

function success() {
  log("\x1b[32m[+] Success!\x1b[39m");
}

function setup() {
  input(
    'Do you want to use a session token or API token? (type "session" or "token"): ',
  ).then((type) => {
    addToSave("use", type);
    if (type == "token") {
      input("Paste your API token: ").then((token) => {
        addToSaveEncrypted("token", token);
        success();
      });
    } else {
      input("Paste your session token: ").then((session) => {
        addToSaveEncrypted("session", session);
        input("Paste a conversation id: ").then((id) => {
          addToSaveEncrypted("id", id);
          success();
        });
      });
    }
  });
}

function input(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
      rl.close();
    });
  });
}

function run(data, filename = "main") {
  const json = readJSON();
  data.externals.forEach((l) => {
    try {
      const fileContent = fs.readFileSync(l, "utf8");
      run(generate(fileContent), l);
    } catch (e) {
      log(`\x1b[31m[x] Failed to read file "${l}"\x1b[39m[x]`);
    }
  });
  let outputName;
  if (data.output) {
    outputName = data.output;
  } else {
    outputName = `codelish-${Date.now().toString(36)}.txt`;
  }
  let variables = "The variables are:\n\n";
  data.variables.forEach((variable) => {
    const { name, content, type } = variable;
    variables += `Variable type:\n${type}\nVariable name:\n${name}\nVariable content:\n${content}\n\n`;
  });
  if (data.oneshot) {
    const text = data.runs.map((item) => item.text).join("\n\n");
    const prompt = `Don't type anything or any explanation. Just send the code in code blocks.\n\nProgramming language: ${data.language}\n\n${variables}\n\nINSTRUCTIONS:\n${text}`;
    ai(prompt, json.use, json.api_model || "gpt-3.5-turbo")
      .then((data) => {
        writeFile(outputName, data.split("\n").slice(1, -1).join("\n"));
      })
      .then((_) => {
        log(`\x1b[32m[+] [1/1] Run 1 in ${filename} done\x1b[39m`);
      })
      .catch((e) => {});
  } else {
    let context = "";
    let once = false;
    let run = 0;
    for (let i = 0; i < data.runs.length; i++) {
      const text = data.runs[i].text;
      let prompt = `Don't type anything or any explanation. Just send the code in code blocks.\n\nProgramming language: ${data.language}\n\n${variables}\n\nINSTRUCTIONS:\n${text}`;
      if (data.runs[i].context && data.runs[i].context === true) {
        prompt += `Here is the code that I already have:\n\n${context}`;
      }
      ai(prompt, json.use, json.session_model || "text-davinci-002-render-sha")
        .then((data) => {
          const content = data.split("\n").slice(1, -1).join("\n");
          context += content;
          if (!once) {
            once = true;
            writeFile(outputName, content);
          } else {
            writeFile(outputName, content, true);
          }
        })
        .then((_) => {
          run++;
          log(
            `\x1b[32m[+] [${run}/${data.runs.length}] Run ${run} in ${filename} done\x1b[39m`,
          );
        })
        .catch((e) => {});
    }
  }
}

async function ai(prompt, type, model) {
  if (type == "token") {
    const token = readData("token");
    if (token == false) {
      return log(
        "\x1b[31m[x] Token missing! (--set-token=your_api_token)\x1b[39m",
      );
    }
    return new Promise((resolve, reject) => {
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: model || "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
        }),
      })
        .then((response) => response.json())
        .then((res) => resolve(res))
        .catch((error) => reject(error));
    });
  } else {
    const token = readData("session");
    const id = readData("id");
    if (token == false || id == false) {
      return log(
        "\x1b[31m[x] Session token missing! (--set-session=your_session_token)\x1b[39m",
      );
    } else if (id == false) {
      return log(
        "\x1b[31m[x] Conversation key or ID missing! (--set-id=your_id)\x1b[39m",
      );
    }
    return new Promise((resolve, reject) => {
      fetch("https://chat.openai.com/backend-api/conversation", {
        headers: {
          accept: "text/event-stream",
          "accept-language": "en-US",
          authorization: "Bearer " + token,
          "content-type": "application/json",
          "sec-ch-ua":
            '"Not_A Brand";v="8", "Chromium";v="120", "Brave";v="120"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "sec-gpc": "1",
        },
        referrerPolicy: "strict-origin-when-cross-origin",
        body: JSON.stringify({
          action: "next",
          messages: [
            {
              author: {
                role: "user",
              },
              content: {
                content_type: "text",
                parts: [prompt],
              },
              metadata: {},
            },
          ],
          conversation_id: id,
          model: model || "text-davinci-002-render-sha",
          timezone_offset_min: -360,
          suggestions: [],
          history_and_training_disabled: false,
          arkose_token: null,
          conversation_mode: {
            kind: "primary_assistant",
          },
          force_paragen: false,
          force_rate_limit: false,
        }),
        method: "POST",
        mode: "cors",
        credentials: "include",
      })
        .then(async (res) => {
          const t = (await res.text()).split("\n");
          try {
            return JSON.parse(t[t.length - 7].replace("data: ", ""));
          } catch (e) {
            log("\x1b[31m[x] Conversation key or ID invalid!\x1b[39m");
            return false;
          }
        })
        .then((data) => {
          if (data == false) {
            reject("Invalid ID!");
          }
          resolve(data.message.content.parts[0]);
        })
        .catch((error) => reject(error));
    });
  }
}

function keyFromPass(password, salt, iterations, keyLength) {
  return crypto.pbkdf2Sync(password, salt, iterations, keyLength, "sha256");
}

function encrypt(token) {
  const salt = crypto.randomBytes(16);
  const iterations = 100000;
  const keyLength = 32;

  const key = keyFromPass(password, salt, iterations, keyLength);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();
  return {
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    iterations: iterations,
    encryptedData: encrypted,
    authTag: authTag.toString("hex"),
  };
}

function decrypt(encryptedData, iv, authTag, salt, iterations) {
  const key = keyFromPass(password, Buffer.from(salt, "hex"), iterations, 32);

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function addToSave(key, value) {
  let existingData = {};
  try {
    const fileContent = fs.readFileSync("codelish.json", "utf8");
    existingData = JSON.parse(fileContent);
  } catch (err) {
    existingData = {};
  }
  existingData[key] = value;
  fs.writeFileSync("codelish.json", JSON.stringify(existingData));
}

function writeFile(name, content, append = false) {
  if (append) {
    try {
      const fileContent = fs.readFileSync(name, "utf8");
      content = fileContent + content;
      fs.writeFileSync(name, content);
    } catch (err) {
      fs.writeFileSync(name, content);
    }
  } else {
    fs.writeFileSync(name, content);
  }
}

function addToSaveEncrypted(name, data) {
  addToSave(name, encrypt(data));
}

function readJSON() {
  let existingData = {};
  try {
    const fileContent = fs.readFileSync("codelish.json", "utf8");
    existingData = JSON.parse(fileContent);
  } catch (err) {
    existingData = {};
    log("Run --setup to get started!");
    process.exit(1);
  }
  return existingData;
}

function readData(name = "token") {
  try {
    const jsonData = readJSON();
    if (!jsonData[name]) {
      return false;
    }
    const { salt, iv, encryptedData, authTag, iterations } = jsonData[name];
    const decryptedToken = decrypt(
      encryptedData,
      iv,
      authTag,
      salt,
      iterations,
    );
    return decryptedToken;
  } catch (error) {
    console.error("Error reading token:", error);
    return null;
  }
}

function generate(fileData) {
  let langRegex = /<(?:lang|language)="([^"]+)"\>/;
  let varRegex =
    /<var(?:\s+type="([^"]*)")?(?:="([^"]*)")?>\s*([^<]+)\s*<\/var>/g;
  let runRegex = /<run(?:\s+context="([^"]*)")?>\s*([^<]+)\s*<\/run>/g;
  let oneshotRegex = /<oneshot="([^"]*)">/;
  let outputRegex = /<output="([^"]*)">/;
  let externalRegex = /<external="([^"]*)">/g;

  let matchLang = fileData.match(langRegex);
  let language = matchLang ? matchLang[1] : null;

  let variables = [];
  let runs = [];
  let externals = [];
  let oneshotMatch;
  let outputMatch;
  let oneshot;
  let varMatch;
  let varCounter = 1;

  while ((varMatch = varRegex.exec(fileData)) !== null) {
    let varType = varMatch[1] || "string";
    let varName = varMatch[2] || `codelishString${varCounter++}`;
    let varContent = varMatch[3].trim();

    variables.push({
      name: varName,
      content: varContent,
      type: varType,
    });
  }

  let runMatch;
  while ((runMatch = runRegex.exec(fileData)) !== null) {
    let runText = runMatch[2].trim();
    let runContext = runMatch[1] === "false" ? false : true;

    let runEntry = {
      text: runText,
    };

    if (!runContext) {
      runEntry.context = false;
    }

    runs.push(runEntry);
  }

  let externalMatch;
  while ((externalMatch = externalRegex.exec(fileData)) !== null) {
    externals.push(externalMatch[1].trim());
  }

  let outputName;

  if ((oneshotMatch = oneshotRegex.exec(fileData)) !== null) {
    let oneshotValue = oneshotMatch[1].toLowerCase();
    oneshot = oneshotValue === "true";
  } else {
    oneshot = false;
  }

  if ((outputMatch = outputRegex.exec(fileData)) !== null) {
    outputName = outputMatch[1];
  } else {
    outputName = false;
  }

  return {
    language,
    variables,
    runs,
    oneshot,
    output: outputName,
    externals,
  };
}
