import React, { useState, useEffect, useMemo, useCallback } from 'react';
import clsx from 'clsx';
import {
  Layers,
  Plus,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { Profile, Engine, IWAD, ValidationItem } from '../../types';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { ProfileEditor } from './ProfileEditor';
import { ImportProfileModal } from './ImportProfileModal';

export interface ProfilesViewProps {
  selectedProfileId?: string | null;
  onSelectProfile?: (id: string | null) => void;
  onNavigateToLibrary?: () => void;
  onNavigateToSettings?: (tab?: string) => void;
  onScanRequested?: () => void;
}

export const ProfilesView: React.FC<ProfilesViewProps> = ({
  selectedProfileId: propSelectedProfileId,
  onSelectProfile,
  onNavigateToLibrary,
  onNavigateToSettings,
  onScanRequested,
}) => {
  const toast = useToast();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [engines, setEngines] = useState<Engine[]>([]);
  const [iwads, setIwads] = useState<IWAD[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    propSelectedProfileId ?? null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importModalFormat, setImportModalFormat] = useState<'yaml' | 'zdl'>('yaml');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');
  const [newProfileEngineId, setNewProfileEngineId] = useState('');
  const [newProfileIwadId, setNewProfileIwadId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Load all initial data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [profs, engs, iws] = await Promise.all([
        api.listProfiles(),
        api.listEngines(),
        api.listIWADs(),
      ]);
      setProfiles(profs || []);
      setEngines(engs || []);
      setIwads(iws || []);
      if (profs && profs.length > 0) {
        setSelectedProfileId((prev) => {
          const next = propSelectedProfileId || (prev && profs.some((p) => p.id === prev) ? prev : profs[0].id);
          onSelectProfile?.(next);
          return next;
        });
      }
    } catch (err: unknown) {
      console.error('Failed to load profiles data:', err);
      toast.error('Data Load Error', 'Could not fetch profiles from backend');
    } finally {
      setIsLoading(false);
    }
  }, [onSelectProfile, propSelectedProfileId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (propSelectedProfileId !== undefined && propSelectedProfileId !== selectedProfileId) {
      setSelectedProfileId(propSelectedProfileId);
    }
  }, [propSelectedProfileId, selectedProfileId]);

  const handleSelectPreset = (id: string) => {
    setSelectedProfileId(id);
    onSelectProfile?.(id);
  };

  const handleAutoDetect = async () => {
    setIsAutoDetecting(true);
    try {
      if (onScanRequested) {
        onScanRequested();
      } else {
        await api.startScan();
      }
      toast.info('Auto-Detection Started', 'Scanning system paths for Doom engines and IWADs...');
      setTimeout(() => {
        loadData();
        setIsAutoDetecting(false);
      }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      toast.error('Scan Error', msg);
      setIsAutoDetecting(false);
    }
  };

  // Currently selected profile object
  const activeProfile = useMemo(() => {
    return profiles.find((p) => p.id === selectedProfileId) || profiles[0] || null;
  }, [profiles, selectedProfileId]);

  // Handle Profile Update from Editor
  const handleProfileChange = (updated: Profile) => {
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  // Handle Profile Delete
  const handleProfileDeleted = (deletedId: string) => {
    setProfiles((prev) => {
      const next = prev.filter((p) => p.id !== deletedId);
      if (selectedProfileId === deletedId) {
        setSelectedProfileId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  // Handle Profile Duplicate
  const handleProfileDuplicated = (duplicated: Profile) => {
    setProfiles((prev) => [duplicated, ...prev]);
    setSelectedProfileId(duplicated.id);
  };

  // Handle Create Profile
  const handleOpenCreateModal = () => {
    setNewProfileName('');
    setNewProfileDescription('');
    setNewProfileEngineId(engines.length > 0 ? engines[0].id : '');
    setNewProfileIwadId(iwads.length > 0 ? iwads[0].id : '');
    setIsCreateModalOpen(true);
  };

  const handleCreateProfileSubmit = async () => {
    if (!newProfileName.trim()) {
      toast.error('Name Required', 'Please enter a name for the preset');
      return;
    }

    const selectedEng = engines.find((e) => e.id === newProfileEngineId);
    const selectedIw = iwads.find((w) => w.id === newProfileIwadId);

    setIsCreating(true);
    try {
      const created = await api.createProfile({
        name: newProfileName.trim(),
        description: newProfileDescription.trim(),
        engineId: newProfileEngineId,
        engineName: selectedEng?.name || '',
        iwadId: newProfileIwadId,
        iwadName: selectedIw?.name || '',
        mods: [],
        arguments: [],
        workingDir: '',
        isFavorite: false,
      });

      setProfiles((prev) => [created, ...prev]);
      setSelectedProfileId(created.id);
      setIsCreateModalOpen(false);
      toast.success('Preset Created', `Created "${created.name}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create preset';
      toast.error('Create Error', msg);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Import YAML / ZDL Success
  const handleImportSuccess = (imported: Profile, _warnings: ValidationItem[]) => {
    setProfiles((prev) => [imported, ...prev]);
    setSelectedProfileId(imported.id);
  };

  return (
    <div className="flex h-full w-full bg-[#0c0e12] overflow-hidden text-zinc-100 select-none">
      {/* 100% Full-Width Stage (Zero Second Sidebar!) */}
      {engines.length === 0 && iwads.length === 0 && !isLoading ? (
        /* First-Run Welcoming Hero */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-xl mx-auto select-none">
          <div className="w-12 h-12 rounded-xl bg-[#14171c] border border-[#22262d] flex items-center justify-center mb-5 text-[#dc2626]">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 mb-2">
            Welcome to RNT Launcher. Let's find your Doom games.
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6">
            Scan your computer to automatically discover installed source ports (GZDoom, PRBoom+, DSDA-Doom, Woof) and base game IWADs (DOOM, DOOM II, Final Doom).
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            <Button
              variant="primary"
              size="md"
              onClick={handleAutoDetect}
              isLoading={isAutoDetecting}
              leftIcon={<RotateCw className={clsx('w-4 h-4', isAutoDetecting && 'animate-spin')} />}
              className="font-medium px-6 bg-[#dc2626] hover:bg-[#ef4444] text-white border-0 text-xs tracking-wide"
            >
              {isAutoDetecting ? 'Auto-Detecting Games...' : 'Auto-Detect Installed Games & Ports'}
            </Button>
          </div>
          <div className="mt-6 flex items-center gap-3 text-xs text-zinc-500">
            <span>Or add manually:</span>
            <button
              type="button"
              onClick={() => onNavigateToSettings?.('engines')}
              className="text-zinc-300 hover:text-white underline underline-offset-2"
            >
              Add Source Port
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => onNavigateToSettings?.('iwads')}
              className="text-zinc-300 hover:text-white underline underline-offset-2"
            >
              Add Base IWAD
            </button>
          </div>
        </div>
      ) : activeProfile ? (
        /* Full-Width Profile Editor with integrated preset dropdown switcher */
        <ProfileEditor
          key={activeProfile.id}
          profile={activeProfile}
          profiles={profiles}
          engines={engines}
          iwads={iwads}
          onProfileChange={handleProfileChange}
          onProfileDeleted={handleProfileDeleted}
          onProfileDuplicated={handleProfileDuplicated}
          onSelectProfile={handleSelectPreset}
          onCreateProfileClick={handleOpenCreateModal}
          onImportClick={() => {
            setImportModalFormat('yaml');
            setIsImportModalOpen(true);
          }}
        />
      ) : (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 gap-3 select-none">
          <div className="w-12 h-12 rounded-xl bg-[#14171c] border border-[#22262d] flex items-center justify-center text-zinc-600 mb-1">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-300">No Presets Configured</h3>
          <p className="text-xs text-zinc-500 max-w-sm">
            Create your first Doom launcher preset to configure source ports, base IWADs, and custom mods.
          </p>
          <div className="flex items-center gap-2.5 mt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreateModal}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="bg-[#dc2626] hover:bg-[#ef4444] text-white text-xs font-medium"
            >
              + New Setup
            </Button>
            {onNavigateToLibrary && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onNavigateToLibrary}
                className="bg-[#14171c] hover:bg-[#181f26] border-[#22262d] text-zinc-300 text-xs"
              >
                Browse Mod Collection
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Create Preset Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Preset Setup"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateProfileSubmit}
              isLoading={isCreating}
              className="bg-[#dc2626] hover:bg-[#ef4444] text-white"
            >
              Create Preset
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Preset Name *"
            placeholder="e.g. Brutal Doom + Metal Soundtrack"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
          />

          <Input
            label="Description / Notes (Optional)"
            placeholder="e.g. Hardcore gameplay mod with modern graphics renderer"
            value={newProfileDescription}
            onChange={(e) => setNewProfileDescription(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider block">
              Default Source Port
            </label>
            <select
              value={newProfileEngineId}
              onChange={(e) => setNewProfileEngineId(e.target.value)}
              className="w-full bg-[#101317] border border-[#22262d] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 font-medium"
            >
              <option value="">-- Select Engine --</option>
              {engines.map((e) => (
                <option key={e.id} value={e.id} className="bg-[#14171c] text-zinc-100">
                  {e.name} ({e.family})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300 uppercase tracking-wider block">
              Default Base Game IWAD
            </label>
            <select
              value={newProfileIwadId}
              onChange={(e) => setNewProfileIwadId(e.target.value)}
              className="w-full bg-[#101317] border border-[#22262d] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 font-medium"
            >
              <option value="">-- Select IWAD --</option>
              {iwads.map((w) => (
                <option key={w.id} value={w.id} className="bg-[#14171c] text-zinc-100">
                  {w.name} ({w.type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <ImportProfileModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        initialFormat={importModalFormat}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
};
