import { mkdir, readFile, writeFile } from "node:fs/promises";

export type BatteryBank = {
  name: string;
  chargeLevel: number;
  capacity: number;
  efficiency: number;
  health: number;
};

export type SolarPanel = {
  name: string;
  efficiency: number;
  panelOn: boolean;
};

export type ResearchLab = {
  progress: number;
  labOn: boolean;
  powerUse: number;
  currentProject: string;
};

export type Rover = {
  name: string;
  health: number;
  speed: number;
  location: string;
};

export type DartLaunchPlatform = {
  dartLoaded: boolean;
  location: string;
  dartLoadAmount: number;
};

export type Fabricator = {
  fabricatorOn: boolean;
  powerUse: number;
  timeLeftConstructing: number;
};

type BatteryBankInput = {
  name: string;
  chargeLevel: string;
  capacity: string;
  efficiency: string;
  health: string;
};

type BatteryBankUpdateInput = {
  name?: string;
  chargeLevel?: string;
  capacity?: string;
  efficiency?: string;
  health?: string;
};

type SolarPanelInput = {
  name: string;
  efficiency: string;
  panelOn: string;
};

type SolarPanelUpdateInput = {
  name?: string;
  efficiency?: string;
  panelOn?: string;
};

type ResearchLabInput = {
  progress: string;
  labOn: string;
  powerUse: string;
  currentProject: string;
};

type ResearchLabUpdateInput = {
  progress?: string;
  labOn?: string;
  powerUse?: string;
  currentProject?: string;
};

type RoverInput = {
  name: string;
  health: string;
  speed: string;
  location: string;
};

type RoverUpdateInput = {
  name?: string;
  health?: string;
  speed?: string;
  location?: string;
};

type DartLaunchPlatformInput = {
  dartLoaded: string;
  location: string;
  dartLoadAmount: string;
};

type DartLaunchPlatformUpdateInput = {
  dartLoaded?: string;
  location?: string;
  dartLoadAmount?: string;
};

type FabricatorInput = {
  fabricatorOn: string;
  powerUse: string;
  timeLeftConstructing: string;
};

type FabricatorUpdateInput = {
  fabricatorOn?: string;
  powerUse?: string;
  timeLeftConstructing?: string;
};

const dataDirectoryUrl = new URL("../data/", import.meta.url);
const dataFileUrl = new URL("../data/batteryBanks.json", import.meta.url);
const solarPanelDataFileUrl = new URL("../data/solarPanels.json", import.meta.url);
const researchLabDataFileUrl = new URL("../data/researchLab.json", import.meta.url);
const roverDataFileUrl = new URL("../data/rovers.json", import.meta.url);
const dartDataFileUrl = new URL("../data/dartLaunchPlatform.json", import.meta.url);
const fabricatorDataFileUrl = new URL("../data/fabricator.json", import.meta.url);

async function loadBatteryBanks(): Promise<BatteryBank[]> {
  try {
    const fileContents = await readFile(dataFileUrl, "utf8");
    const data = JSON.parse(fileContents) as { batteryBanks?: BatteryBank[] };
    return data.batteryBanks ?? [];
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function saveBatteryBanks(batteryBanks: BatteryBank[]): Promise<void> {
  await mkdir(dataDirectoryUrl, { recursive: true });
  await writeFile(
    dataFileUrl,
    JSON.stringify({ batteryBanks }, null, 2) + "\n",
    "utf8",
  );
}

async function loadSolarPanels(): Promise<SolarPanel[]> {
  try {
    const fileContents = await readFile(solarPanelDataFileUrl, "utf8");
    const data = JSON.parse(fileContents) as { solarPanels?: SolarPanel[] };
    return data.solarPanels ?? [];
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function saveSolarPanels(solarPanels: SolarPanel[]): Promise<void> {
  await mkdir(dataDirectoryUrl, { recursive: true });
  await writeFile(
    solarPanelDataFileUrl,
    JSON.stringify({ solarPanels }, null, 2) + "\n",
    "utf8",
  );
}

async function loadResearchLab(): Promise<ResearchLab | undefined> {
  try {
    const fileContents = await readFile(researchLabDataFileUrl, "utf8");
    const data = JSON.parse(fileContents) as { researchLab?: ResearchLab };
    return data.researchLab;
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }

    throw error;
  }
}

async function saveResearchLab(researchLab: ResearchLab): Promise<void> {
  await mkdir(dataDirectoryUrl, { recursive: true });
  await writeFile(
    researchLabDataFileUrl,
    JSON.stringify({ researchLab }, null, 2) + "\n",
    "utf8",
  );
}

async function deleteResearchLabFile(): Promise<void> {
  await writeFile(researchLabDataFileUrl, JSON.stringify({}, null, 2) + "\n", "utf8");
}

async function loadRovers(): Promise<Rover[]> {
  try {
    const fileContents = await readFile(roverDataFileUrl, "utf8");
    const data = JSON.parse(fileContents) as { rovers?: Rover[] };
    return data.rovers ?? [];
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function saveRovers(rovers: Rover[]): Promise<void> {
  await mkdir(dataDirectoryUrl, { recursive: true });
  await writeFile(
    roverDataFileUrl,
    JSON.stringify({ rovers }, null, 2) + "\n",
    "utf8",
  );
}

async function loadDartLaunchPlatform(): Promise<DartLaunchPlatform | undefined> {
  try {
    const fileContents = await readFile(dartDataFileUrl, "utf8");
    const data = JSON.parse(fileContents) as { dartLaunchPlatform?: DartLaunchPlatform };
    return data.dartLaunchPlatform;
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }

    throw error;
  }
}

async function saveDartLaunchPlatform(dartLaunchPlatform: DartLaunchPlatform): Promise<void> {
  await mkdir(dataDirectoryUrl, { recursive: true });
  await writeFile(
    dartDataFileUrl,
    JSON.stringify({ dartLaunchPlatform }, null, 2) + "\n",
    "utf8",
  );
}

async function deleteDartLaunchPlatformFile(): Promise<void> {
  await writeFile(dartDataFileUrl, JSON.stringify({}, null, 2) + "\n", "utf8");
}

async function loadFabricator(): Promise<Fabricator | undefined> {
  try {
    const fileContents = await readFile(fabricatorDataFileUrl, "utf8");
    const data = JSON.parse(fileContents) as { fabricator?: Fabricator };
    return data.fabricator;
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }

    throw error;
  }
}

async function saveFabricator(fabricator: Fabricator): Promise<void> {
  await mkdir(dataDirectoryUrl, { recursive: true });
  await writeFile(
    fabricatorDataFileUrl,
    JSON.stringify({ fabricator }, null, 2) + "\n",
    "utf8",
  );
}

async function deleteFabricatorFile(): Promise<void> {
  await writeFile(fabricatorDataFileUrl, JSON.stringify({}, null, 2) + "\n", "utf8");
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function parseRequiredNumber(value: string, fieldName: string): number {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }

  return parsedValue;
}

function parseOptionalNumber(value: string | undefined, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseRequiredNumber(value, fieldName);
}

function validateName(name: string, fieldName: string): string {
  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return trimmedName;
}

function parseBoolean(value: string, fieldName: string): boolean {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  throw new Error(`${fieldName} must be true or false.`);
}

function parseOptionalBoolean(value: string | undefined, fieldName: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseBoolean(value, fieldName);
}

function parseRequiredText(value: string, fieldName: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return trimmedValue;
}

export function formatBatteryBank(batteryBank: BatteryBank): string {
  return [
    `name: ${batteryBank.name}`,
    `chargeLevel: ${batteryBank.chargeLevel}`,
    `capacity: ${batteryBank.capacity}`,
    `efficiency: ${batteryBank.efficiency}`,
    `health: ${batteryBank.health}`,
  ].join("\n");
}

export function formatBatteryBankSummary(batteryBank: BatteryBank): string {
  return [
    `name: ${batteryBank.name}`,
    `chargeLevel: ${batteryBank.chargeLevel}`,
    `capacity: ${batteryBank.capacity}`,
  ].join(" | ");
}

export function formatSolarPanel(solarPanel: SolarPanel): string {
  return [
    `name: ${solarPanel.name}`,
    `efficiency: ${solarPanel.efficiency}`,
    `panelOn: ${solarPanel.panelOn}`,
  ].join("\n");
}

export function formatSolarPanelSummary(solarPanel: SolarPanel): string {
  return [
    `name: ${solarPanel.name}`,
    `efficiency: ${solarPanel.efficiency}`,
    `panelOn: ${solarPanel.panelOn}`,
  ].join(" | ");
}

export function formatResearchLab(researchLab: ResearchLab): string {
  return [
    `progress: ${researchLab.progress}`,
    `labOn: ${researchLab.labOn}`,
    `powerUse: ${researchLab.powerUse}`,
    `currentProject: ${researchLab.currentProject}`,
  ].join("\n");
}

export function formatRover(rover: Rover): string {
  return [
    `name: ${rover.name}`,
    `health: ${rover.health}`,
    `speed: ${rover.speed}`,
    `location: ${rover.location}`,
  ].join("\n");
}

export function formatRoverSummary(rover: Rover): string {
  return [
    `name: ${rover.name}`,
    `health: ${rover.health}`,
    `location: ${rover.location}`,
  ].join(" | ");
}

export function formatDartLaunchPlatform(dartLaunchPlatform: DartLaunchPlatform): string {
  return [
    `dartLoaded: ${dartLaunchPlatform.dartLoaded}`,
    `location: ${dartLaunchPlatform.location}`,
    `dartLoadAmount: ${dartLaunchPlatform.dartLoadAmount}`,
  ].join("\n");
}

export function formatFabricator(fabricator: Fabricator): string {
  return [
    `fabricatorOn: ${fabricator.fabricatorOn}`,
    `powerUse: ${fabricator.powerUse}`,
    `timeLeftConstructing: ${fabricator.timeLeftConstructing}`,
  ].join("\n");
}

export async function listBatteryBanks(): Promise<BatteryBank[]> {
  return loadBatteryBanks();
}

export async function findBatteryBank(name: string): Promise<BatteryBank | undefined> {
  const batteryBanks = await loadBatteryBanks();
  return batteryBanks.find((batteryBank) => batteryBank.name === name);
}

export async function createBatteryBank(input: BatteryBankInput): Promise<BatteryBank> {
  const batteryBanks = await loadBatteryBanks();
  const name = validateName(input.name, "name");

  if (batteryBanks.some((batteryBank) => batteryBank.name === name)) {
    throw new Error(`Battery bank "${name}" already exists.`);
  }

  const batteryBank: BatteryBank = {
    name,
    chargeLevel: parseRequiredNumber(input.chargeLevel, "chargeLevel"),
    capacity: parseRequiredNumber(input.capacity, "capacity"),
    efficiency: parseRequiredNumber(input.efficiency, "efficiency"),
    health: parseRequiredNumber(input.health, "health"),
  };

  batteryBanks.push(batteryBank);
  await saveBatteryBanks(batteryBanks);

  return batteryBank;
}

export async function updateBatteryBank(
  name: string,
  input: BatteryBankUpdateInput,
): Promise<BatteryBank> {
  const batteryBanks = await loadBatteryBanks();
  const existingBatteryBank = batteryBanks.find((batteryBank) => batteryBank.name === name);

  if (!existingBatteryBank) {
    throw new Error(`Battery bank "${name}" was not found.`);
  }

  const updatedName =
    input.name !== undefined ? validateName(input.name, "name") : existingBatteryBank.name;

  if (
    updatedName !== existingBatteryBank.name &&
    batteryBanks.some((batteryBank) => batteryBank.name === updatedName)
  ) {
    throw new Error(`Battery bank "${updatedName}" already exists.`);
  }

  existingBatteryBank.name = updatedName;
  existingBatteryBank.chargeLevel =
    parseOptionalNumber(input.chargeLevel, "chargeLevel") ?? existingBatteryBank.chargeLevel;
  existingBatteryBank.capacity =
    parseOptionalNumber(input.capacity, "capacity") ?? existingBatteryBank.capacity;
  existingBatteryBank.efficiency =
    parseOptionalNumber(input.efficiency, "efficiency") ?? existingBatteryBank.efficiency;
  existingBatteryBank.health =
    parseOptionalNumber(input.health, "health") ?? existingBatteryBank.health;

  await saveBatteryBanks(batteryBanks);
  return existingBatteryBank;
}

export async function deleteBatteryBank(name: string): Promise<void> {
  const batteryBanks = await loadBatteryBanks();
  const nextBatteryBanks = batteryBanks.filter((batteryBank) => batteryBank.name !== name);

  if (nextBatteryBanks.length === batteryBanks.length) {
    throw new Error(`Battery bank "${name}" was not found.`);
  }

  await saveBatteryBanks(nextBatteryBanks);
}

export async function listSolarPanels(): Promise<SolarPanel[]> {
  return loadSolarPanels();
}

export async function findSolarPanel(name: string): Promise<SolarPanel | undefined> {
  const solarPanels = await loadSolarPanels();
  return solarPanels.find((solarPanel) => solarPanel.name === name);
}

export async function createSolarPanel(input: SolarPanelInput): Promise<SolarPanel> {
  const solarPanels = await loadSolarPanels();
  const name = validateName(input.name, "name");

  if (solarPanels.some((solarPanel) => solarPanel.name === name)) {
    throw new Error(`Solar panel "${name}" already exists.`);
  }

  const solarPanel: SolarPanel = {
    name,
    efficiency: parseRequiredNumber(input.efficiency, "efficiency"),
    panelOn: parseBoolean(input.panelOn, "panelOn"),
  };

  solarPanels.push(solarPanel);
  await saveSolarPanels(solarPanels);

  return solarPanel;
}

export async function updateSolarPanel(
  name: string,
  input: SolarPanelUpdateInput,
): Promise<SolarPanel> {
  const solarPanels = await loadSolarPanels();
  const existingSolarPanel = solarPanels.find((solarPanel) => solarPanel.name === name);

  if (!existingSolarPanel) {
    throw new Error(`Solar panel "${name}" was not found.`);
  }

  const updatedName =
    input.name !== undefined ? validateName(input.name, "name") : existingSolarPanel.name;

  if (
    updatedName !== existingSolarPanel.name &&
    solarPanels.some((solarPanel) => solarPanel.name === updatedName)
  ) {
    throw new Error(`Solar panel "${updatedName}" already exists.`);
  }

  existingSolarPanel.name = updatedName;
  existingSolarPanel.efficiency =
    parseOptionalNumber(input.efficiency, "efficiency") ?? existingSolarPanel.efficiency;
  existingSolarPanel.panelOn =
    parseOptionalBoolean(input.panelOn, "panelOn") ?? existingSolarPanel.panelOn;

  await saveSolarPanels(solarPanels);
  return existingSolarPanel;
}

export async function deleteSolarPanel(name: string): Promise<void> {
  const solarPanels = await loadSolarPanels();
  const nextSolarPanels = solarPanels.filter((solarPanel) => solarPanel.name !== name);

  if (nextSolarPanels.length === solarPanels.length) {
    throw new Error(`Solar panel "${name}" was not found.`);
  }

  await saveSolarPanels(nextSolarPanels);
}

export async function createResearchLab(input: ResearchLabInput): Promise<ResearchLab> {
  const existingResearchLab = await loadResearchLab();

  if (existingResearchLab) {
    throw new Error("Research lab already exists.");
  }

  const researchLab: ResearchLab = {
    progress: parseRequiredNumber(input.progress, "progress"),
    labOn: parseBoolean(input.labOn, "labOn"),
    powerUse: parseRequiredNumber(input.powerUse, "powerUse"),
    currentProject: parseRequiredText(input.currentProject, "currentProject"),
  };

  await saveResearchLab(researchLab);
  return researchLab;
}

export async function readResearchLab(): Promise<ResearchLab | undefined> {
  return loadResearchLab();
}

export async function updateResearchLabProgress(
  input: ResearchLabUpdateInput,
): Promise<ResearchLab> {
  const researchLab = await loadResearchLab();

  if (!researchLab) {
    throw new Error("Research lab was not found.");
  }

  researchLab.progress = parseOptionalNumber(input.progress, "progress") ?? researchLab.progress;
  researchLab.labOn = parseOptionalBoolean(input.labOn, "labOn") ?? researchLab.labOn;
  researchLab.powerUse = parseOptionalNumber(input.powerUse, "powerUse") ?? researchLab.powerUse;
  researchLab.currentProject =
    input.currentProject !== undefined
      ? parseRequiredText(input.currentProject, "currentProject")
      : researchLab.currentProject;

  await saveResearchLab(researchLab);
  return researchLab;
}

export async function deleteResearchLab(): Promise<void> {
  const researchLab = await loadResearchLab();

  if (!researchLab) {
    throw new Error("Research lab was not found.");
  }

  await deleteResearchLabFile();
}

export async function createRover(input: RoverInput): Promise<Rover> {
  const rovers = await loadRovers();
  const name = validateName(input.name, "name");

  if (rovers.some((rover) => rover.name === name)) {
    throw new Error(`Rover "${name}" already exists.`);
  }

  const rover: Rover = {
    name,
    health: parseRequiredNumber(input.health, "health"),
    speed: parseRequiredNumber(input.speed, "speed"),
    location: parseRequiredText(input.location, "location"),
  };

  rovers.push(rover);
  await saveRovers(rovers);
  return rover;
}

export async function listRovers(): Promise<Rover[]> {
  return loadRovers();
}

export async function findRover(name: string): Promise<Rover | undefined> {
  const rovers = await loadRovers();
  return rovers.find((rover) => rover.name === name);
}

export async function moveRover(name: string, input: RoverUpdateInput): Promise<Rover> {
  const rovers = await loadRovers();
  const rover = rovers.find((item) => item.name === name);

  if (!rover) {
    throw new Error(`Rover "${name}" was not found.`);
  }

  rover.location =
    input.location !== undefined ? parseRequiredText(input.location, "location") : rover.location;
  rover.speed = parseOptionalNumber(input.speed, "speed") ?? rover.speed;
  rover.health = parseOptionalNumber(input.health, "health") ?? rover.health;

  if (input.name !== undefined) {
    const updatedName = validateName(input.name, "name");

    if (updatedName !== rover.name && rovers.some((item) => item.name === updatedName)) {
      throw new Error(`Rover "${updatedName}" already exists.`);
    }

    rover.name = updatedName;
  }

  await saveRovers(rovers);
  return rover;
}

export async function deleteRover(name: string): Promise<void> {
  const rovers = await loadRovers();
  const nextRovers = rovers.filter((rover) => rover.name !== name);

  if (nextRovers.length === rovers.length) {
    throw new Error(`Rover "${name}" was not found.`);
  }

  await saveRovers(nextRovers);
}

export async function createDartLaunchPlatform(
  input: DartLaunchPlatformInput,
): Promise<DartLaunchPlatform> {
  const existingDartLaunchPlatform = await loadDartLaunchPlatform();

  if (existingDartLaunchPlatform) {
    throw new Error("Dart launch platform already exists.");
  }

  const dartLaunchPlatform: DartLaunchPlatform = {
    dartLoaded: parseBoolean(input.dartLoaded, "dartLoaded"),
    location: parseRequiredText(input.location, "location"),
    dartLoadAmount: parseRequiredNumber(input.dartLoadAmount, "dartLoadAmount"),
  };

  await saveDartLaunchPlatform(dartLaunchPlatform);
  return dartLaunchPlatform;
}

export async function readDartLaunchPlatform(): Promise<DartLaunchPlatform | undefined> {
  return loadDartLaunchPlatform();
}

export async function updateDartLaunchPlatform(
  input: DartLaunchPlatformUpdateInput,
): Promise<DartLaunchPlatform> {
  const dartLaunchPlatform = await loadDartLaunchPlatform();

  if (!dartLaunchPlatform) {
    throw new Error("Dart launch platform was not found.");
  }

  dartLaunchPlatform.dartLoaded =
    parseOptionalBoolean(input.dartLoaded, "dartLoaded") ?? dartLaunchPlatform.dartLoaded;
  dartLaunchPlatform.location =
    input.location !== undefined
      ? parseRequiredText(input.location, "location")
      : dartLaunchPlatform.location;
  dartLaunchPlatform.dartLoadAmount =
    parseOptionalNumber(input.dartLoadAmount, "dartLoadAmount") ??
    dartLaunchPlatform.dartLoadAmount;

  await saveDartLaunchPlatform(dartLaunchPlatform);
  return dartLaunchPlatform;
}

export async function loadDart(dartLoadAmount: string): Promise<DartLaunchPlatform> {
  const dartLaunchPlatform = await loadDartLaunchPlatform();

  if (!dartLaunchPlatform) {
    throw new Error("Dart launch platform was not found.");
  }

  dartLaunchPlatform.dartLoaded = true;
  dartLaunchPlatform.dartLoadAmount = parseRequiredNumber(dartLoadAmount, "dartLoadAmount");

  await saveDartLaunchPlatform(dartLaunchPlatform);
  return dartLaunchPlatform;
}

export async function launchDart(): Promise<DartLaunchPlatform> {
  const dartLaunchPlatform = await loadDartLaunchPlatform();

  if (!dartLaunchPlatform) {
    throw new Error("Dart launch platform was not found.");
  }

  dartLaunchPlatform.dartLoaded = false;
  dartLaunchPlatform.dartLoadAmount = 0;

  await saveDartLaunchPlatform(dartLaunchPlatform);
  return dartLaunchPlatform;
}

export async function deleteDartLaunchPlatform(): Promise<void> {
  const dartLaunchPlatform = await loadDartLaunchPlatform();

  if (!dartLaunchPlatform) {
    throw new Error("Dart launch platform was not found.");
  }

  await deleteDartLaunchPlatformFile();
}

export async function createFabricator(input: FabricatorInput): Promise<Fabricator> {
  const existingFabricator = await loadFabricator();

  if (existingFabricator) {
    throw new Error("Fabricator already exists.");
  }

  const fabricator: Fabricator = {
    fabricatorOn: parseBoolean(input.fabricatorOn, "fabricatorOn"),
    powerUse: parseRequiredNumber(input.powerUse, "powerUse"),
    timeLeftConstructing: parseRequiredNumber(
      input.timeLeftConstructing,
      "timeLeftConstructing",
    ),
  };

  await saveFabricator(fabricator);
  return fabricator;
}

export async function readFabricator(): Promise<Fabricator | undefined> {
  return loadFabricator();
}

export async function updateFabricator(input: FabricatorUpdateInput): Promise<Fabricator> {
  const fabricator = await loadFabricator();

  if (!fabricator) {
    throw new Error("Fabricator was not found.");
  }

  fabricator.fabricatorOn =
    parseOptionalBoolean(input.fabricatorOn, "fabricatorOn") ?? fabricator.fabricatorOn;
  fabricator.powerUse = parseOptionalNumber(input.powerUse, "powerUse") ?? fabricator.powerUse;
  fabricator.timeLeftConstructing =
    parseOptionalNumber(input.timeLeftConstructing, "timeLeftConstructing") ??
    fabricator.timeLeftConstructing;

  await saveFabricator(fabricator);
  return fabricator;
}

export async function constructFabricator(
  timeLeftConstructing: string,
  powerUse?: string,
): Promise<Fabricator> {
  const fabricator = await loadFabricator();

  if (!fabricator) {
    throw new Error("Fabricator was not found.");
  }

  fabricator.fabricatorOn = true;
  fabricator.timeLeftConstructing = parseRequiredNumber(
    timeLeftConstructing,
    "timeLeftConstructing",
  );
  fabricator.powerUse = parseOptionalNumber(powerUse, "powerUse") ?? fabricator.powerUse;

  await saveFabricator(fabricator);
  return fabricator;
}

export async function deleteFabricator(): Promise<void> {
  const fabricator = await loadFabricator();

  if (!fabricator) {
    throw new Error("Fabricator was not found.");
  }

  await deleteFabricatorFile();
}
