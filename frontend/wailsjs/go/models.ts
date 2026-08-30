export namespace domain {
	
	export class DatabaseHealth {
	    status: string;
	    path: string;
	    integrityCheck: string;
	    modCount: number;
	    iwadCount: number;
	    engineCount: number;
	    profileCount: number;
	    historyCount: number;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseHealth(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.path = source["path"];
	        this.integrityCheck = source["integrityCheck"];
	        this.modCount = source["modCount"];
	        this.iwadCount = source["iwadCount"];
	        this.engineCount = source["engineCount"];
	        this.profileCount = source["profileCount"];
	        this.historyCount = source["historyCount"];
	    }
	}
	export class DiagnosticIssue {
	    id: string;
	    category: string;
	    severity: string;
	    title: string;
	    description: string;
	    targetId?: string;
	    targetPath?: string;
	    canRepair: boolean;
	    repairAction?: string;
	    repairDescription?: string;
	
	    static createFrom(source: any = {}) {
	        return new DiagnosticIssue(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.category = source["category"];
	        this.severity = source["severity"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.targetId = source["targetId"];
	        this.targetPath = source["targetPath"];
	        this.canRepair = source["canRepair"];
	        this.repairAction = source["repairAction"];
	        this.repairDescription = source["repairDescription"];
	    }
	}
	export class DiagnosticsSummary {
	    totalIssues: number;
	    errorCount: number;
	    warningCount: number;
	    infoCount: number;
	
	    static createFrom(source: any = {}) {
	        return new DiagnosticsSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalIssues = source["totalIssues"];
	        this.errorCount = source["errorCount"];
	        this.warningCount = source["warningCount"];
	        this.infoCount = source["infoCount"];
	    }
	}
	export class DiagnosticsReport {
	    overallStatus: string;
	    database: DatabaseHealth;
	    issues: DiagnosticIssue[];
	    summary: DiagnosticsSummary;
	    // Go type: time
	    generatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new DiagnosticsReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.overallStatus = source["overallStatus"];
	        this.database = this.convertValues(source["database"], DatabaseHealth);
	        this.issues = this.convertValues(source["issues"], DiagnosticIssue);
	        this.summary = this.convertValues(source["summary"], DiagnosticsSummary);
	        this.generatedAt = this.convertValues(source["generatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Engine {
	    id: string;
	    name: string;
	    executable: string;
	    version: string;
	    family: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Engine(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.executable = source["executable"];
	        this.version = source["version"];
	        this.family = source["family"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HistoryStats {
	    totalLaunches: number;
	    totalPlayTimeMs: number;
	    // Go type: time
	    lastLaunchedAt?: any;
	    mostPlayedProfileId?: string;
	    mostPlayedProfileName?: string;
	
	    static createFrom(source: any = {}) {
	        return new HistoryStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalLaunches = source["totalLaunches"];
	        this.totalPlayTimeMs = source["totalPlayTimeMs"];
	        this.lastLaunchedAt = this.convertValues(source["lastLaunchedAt"], null);
	        this.mostPlayedProfileId = source["mostPlayedProfileId"];
	        this.mostPlayedProfileName = source["mostPlayedProfileName"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class IWAD {
	    id: string;
	    name: string;
	    path: string;
	    type: string;
	    lumpCount: number;
	    size: number;
	    sha256: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new IWAD(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.path = source["path"];
	        this.type = source["type"];
	        this.lumpCount = source["lumpCount"];
	        this.size = source["size"];
	        this.sha256 = source["sha256"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LaunchRecord {
	    id: string;
	    profileId: string;
	    profileName: string;
	    engineName: string;
	    iwadName: string;
	    // Go type: time
	    startedAt: any;
	    // Go type: time
	    finishedAt: any;
	    durationMs: number;
	    exitCode: number;
	    status: string;
	    commandLine: string;
	
	    static createFrom(source: any = {}) {
	        return new LaunchRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.profileId = source["profileId"];
	        this.profileName = source["profileName"];
	        this.engineName = source["engineName"];
	        this.iwadName = source["iwadName"];
	        this.startedAt = this.convertValues(source["startedAt"], null);
	        this.finishedAt = this.convertValues(source["finishedAt"], null);
	        this.durationMs = source["durationMs"];
	        this.exitCode = source["exitCode"];
	        this.status = source["status"];
	        this.commandLine = source["commandLine"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Mod {
	    id: string;
	    name: string;
	    path: string;
	    format: string;
	    category: string;
	    size: number;
	    // Go type: time
	    modifiedAt: any;
	    sha256: string;
	    lumpCount: number;
	    structures: string[];
	    isFavorite: boolean;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Mod(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.path = source["path"];
	        this.format = source["format"];
	        this.category = source["category"];
	        this.size = source["size"];
	        this.modifiedAt = this.convertValues(source["modifiedAt"], null);
	        this.sha256 = source["sha256"];
	        this.lumpCount = source["lumpCount"];
	        this.structures = source["structures"];
	        this.isFavorite = source["isFavorite"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ModFilter {
	    search?: string;
	    category?: string;
	    format?: string;
	    isFavorite?: boolean;
	    limit?: number;
	    offset?: number;
	
	    static createFrom(source: any = {}) {
	        return new ModFilter(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.search = source["search"];
	        this.category = source["category"];
	        this.format = source["format"];
	        this.isFavorite = source["isFavorite"];
	        this.limit = source["limit"];
	        this.offset = source["offset"];
	    }
	}
	export class ProfileMod {
	    id: string;
	    profileId: string;
	    modId: string;
	    modName: string;
	    modPath: string;
	    modFormat: string;
	    enabled: boolean;
	    order: number;
	
	    static createFrom(source: any = {}) {
	        return new ProfileMod(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.profileId = source["profileId"];
	        this.modId = source["modId"];
	        this.modName = source["modName"];
	        this.modPath = source["modPath"];
	        this.modFormat = source["modFormat"];
	        this.enabled = source["enabled"];
	        this.order = source["order"];
	    }
	}
	export class Profile {
	    id: string;
	    name: string;
	    description: string;
	    engineId: string;
	    engineName: string;
	    iwadId: string;
	    iwadName: string;
	    parentProfileId?: string;
	    isolateSaves: boolean;
	    mods: ProfileMod[];
	    arguments: string[];
	    workingDir: string;
	    isFavorite: boolean;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Profile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.engineId = source["engineId"];
	        this.engineName = source["engineName"];
	        this.iwadId = source["iwadId"];
	        this.iwadName = source["iwadName"];
	        this.parentProfileId = source["parentProfileId"];
	        this.isolateSaves = source["isolateSaves"];
	        this.mods = this.convertValues(source["mods"], ProfileMod);
	        this.arguments = source["arguments"];
	        this.workingDir = source["workingDir"];
	        this.isFavorite = source["isFavorite"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ScanResult {
	    discoveredMods: number;
	    discoveredIWADs: number;
	    discoveredEngines: number;
	    errors: string[];
	
	    static createFrom(source: any = {}) {
	        return new ScanResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.discoveredMods = source["discoveredMods"];
	        this.discoveredIWADs = source["discoveredIWADs"];
	        this.discoveredEngines = source["discoveredEngines"];
	        this.errors = source["errors"];
	    }
	}
	export class Settings {
	    modDirectories: string[];
	    iwadDirectories: string[];
	    engineDirectories: string[];
	    defaultWorkingDir: string;
	    theme: string;
	    confirmLaunch: boolean;
	    autoScanOnStartup: boolean;
	    closeOnLaunch: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modDirectories = source["modDirectories"];
	        this.iwadDirectories = source["iwadDirectories"];
	        this.engineDirectories = source["engineDirectories"];
	        this.defaultWorkingDir = source["defaultWorkingDir"];
	        this.theme = source["theme"];
	        this.confirmLaunch = source["confirmLaunch"];
	        this.autoScanOnStartup = source["autoScanOnStartup"];
	        this.closeOnLaunch = source["closeOnLaunch"];
	    }
	}
	export class ValidationItem {
	    severity: string;
	    code: string;
	    message: string;
	    target: string;
	
	    static createFrom(source: any = {}) {
	        return new ValidationItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.severity = source["severity"];
	        this.code = source["code"];
	        this.message = source["message"];
	        this.target = source["target"];
	    }
	}
	export class ValidationResult {
	    status: string;
	    items: ValidationItem[];
	    engine?: Engine;
	    iwad?: IWAD;
	    enabledMods?: ProfileMod[];
	
	    static createFrom(source: any = {}) {
	        return new ValidationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.items = this.convertValues(source["items"], ValidationItem);
	        this.engine = this.convertValues(source["engine"], Engine);
	        this.iwad = this.convertValues(source["iwad"], IWAD);
	        this.enabledMods = this.convertValues(source["enabledMods"], ProfileMod);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace filesystem {
	
	export class ArchiveInfo {
	    format: string;
	    entryCount: number;
	    entries?: string[];
	    maps: string[];
	    structures: string[];
	
	    static createFrom(source: any = {}) {
	        return new ArchiveInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.format = source["format"];
	        this.entryCount = source["entryCount"];
	        this.entries = source["entries"];
	        this.maps = source["maps"];
	        this.structures = source["structures"];
	    }
	}
	export class WADInfo {
	    magic: string;
	    isIwad: boolean;
	    lumpCount: number;
	    lumps?: string[];
	    maps: string[];
	    structures: string[];
	
	    static createFrom(source: any = {}) {
	        return new WADInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.magic = source["magic"];
	        this.isIwad = source["isIwad"];
	        this.lumpCount = source["lumpCount"];
	        this.lumps = source["lumps"];
	        this.maps = source["maps"];
	        this.structures = source["structures"];
	    }
	}
	export class FileInfo {
	    path: string;
	    filename: string;
	    size: number;
	    // Go type: time
	    modTime: any;
	    sha256: string;
	    format: string;
	    category: string;
	    isIwad: boolean;
	    lumpCount: number;
	    maps: string[];
	    structures: string[];
	    inspectionError?: string;
	    wadInfo?: WADInfo;
	    archiveInfo?: ArchiveInfo;
	
	    static createFrom(source: any = {}) {
	        return new FileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.filename = source["filename"];
	        this.size = source["size"];
	        this.modTime = this.convertValues(source["modTime"], null);
	        this.sha256 = source["sha256"];
	        this.format = source["format"];
	        this.category = source["category"];
	        this.isIwad = source["isIwad"];
	        this.lumpCount = source["lumpCount"];
	        this.maps = source["maps"];
	        this.structures = source["structures"];
	        this.inspectionError = source["inspectionError"];
	        this.wadInfo = this.convertValues(source["wadInfo"], WADInfo);
	        this.archiveInfo = this.convertValues(source["archiveInfo"], ArchiveInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace idgames {
	
	export class IdgamesFile {
	    id: number;
	    title: string;
	    dir: string;
	    filename: string;
	    size: number;
	    age: number;
	    date: string;
	    author: string;
	    description: string;
	    rating: number;
	    votes: number;
	    url: string;
	
	    static createFrom(source: any = {}) {
	        return new IdgamesFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.dir = source["dir"];
	        this.filename = source["filename"];
	        this.size = source["size"];
	        this.age = source["age"];
	        this.date = source["date"];
	        this.author = source["author"];
	        this.description = source["description"];
	        this.rating = source["rating"];
	        this.votes = source["votes"];
	        this.url = source["url"];
	    }
	}

}

export namespace launcher {
	
	export class ActiveLaunch {
	    id: string;
	    profileId: string;
	    profileName: string;
	    engineName: string;
	    iwadName: string;
	    pid: number;
	    // Go type: time
	    startedAt: any;
	    commandLine: string;
	
	    static createFrom(source: any = {}) {
	        return new ActiveLaunch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.profileId = source["profileId"];
	        this.profileName = source["profileName"];
	        this.engineName = source["engineName"];
	        this.iwadName = source["iwadName"];
	        this.pid = source["pid"];
	        this.startedAt = this.convertValues(source["startedAt"], null);
	        this.commandLine = source["commandLine"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace logger {
	
	export class LogEntry {
	    // Go type: time
	    timestamp: any;
	    level: string;
	    message: string;
	    fields?: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new LogEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timestamp = this.convertValues(source["timestamp"], null);
	        this.level = source["level"];
	        this.message = source["message"];
	        this.fields = source["fields"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

