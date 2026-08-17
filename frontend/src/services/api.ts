import { api as libApi } from '../lib/api';
import {
  onScanStart,
  onScanProgress,
  onScanComplete,
  onLaunchStart,
  onLaunchExit,
} from '../lib/events';
import { Profile, ValidationItem } from '../types';

export const api = {
  ...libApi,
  onScanStart,
  onScanProgress,
  onScanComplete,
  onLaunchStart,
  onLaunchExit,
  async importProfileYAML(yamlContent: string): Promise<{ profile: Profile; warnings: ValidationItem[] }> {
    const res = (await libApi.importProfileYAML(yamlContent)) as { profile: Profile; warnings?: ValidationItem[] };
    return {
      profile: res.profile,
      warnings: res.warnings || [],
    };
  },
};
