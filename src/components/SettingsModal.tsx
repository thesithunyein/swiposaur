import React, { useEffect, useState } from 'react';
import { X, Volume2, VolumeX, Eye, Smartphone, RotateCcw, ShieldAlert, Settings, User, Check } from 'lucide-react';
import { GameSettings } from '../game/settings.ts';
import { sounds } from '../game/SoundEngine.ts';
import { getPlayerId, loadPlayerName, savePlayerName, syncPlayerName } from '../game/leaderboard.ts';
import { MAX_PLAYER_NAME_LENGTH } from '../game/leaderboardCore.ts';
import { LANGUAGES, setLanguage, t, useLanguage, type Language } from '../game/i18n.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings & { isMuted?: boolean };
  onUpdateSettings: (newSettings: any) => void;
  onResetProgress: () => void;
  /** Called after a rename reaches the server, so the board can refresh. */
  onPlayerNameSaved?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetProgress,
  onPlayerNameSaved,
}) => {
  const language = useLanguage();
  const [showConfirmReset, setShowConfirmReset] = useState<boolean>(false);
  const [nameDraft, setNameDraft] = useState<string>(() => loadPlayerName());
  const [nameSaved, setNameSaved] = useState<boolean>(false);

  // Refresh the field each time the panel opens, in case the stored name changed.
  useEffect(() => {
    if (!isOpen) return;
    setNameDraft(loadPlayerName());
    setNameSaved(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const commitName = () => {
    const previous = loadPlayerName();
    const saved = savePlayerName(nameDraft);
    setNameDraft(saved);
    setNameSaved(true);
    if (saved !== previous) {
      void syncPlayerName(getPlayerId(), saved).then((synced) => {
        if (synced) onPlayerNameSaved?.();
      });
    }
  };

  const toggleSound = () => {
    sounds.playClick();
    const nextMuted = !settings.isMuted;
    sounds.setMuted(nextMuted);
    onUpdateSettings({ ...settings, isMuted: nextMuted, soundEnabled: !nextMuted });
  };

  const toggleShake = () => {
    sounds.playClick();
    onUpdateSettings({ ...settings, cameraShake: !settings.cameraShake });
  };

  const toggleReducedMotion = () => {
    sounds.playClick();
    onUpdateSettings({ ...settings, reducedMotion: !settings.reducedMotion });
  };

  const toggleFocus = () => {
    sounds.playClick();
    const next = settings.characterFocus === 'classic' ? 'close' : 'classic';
    onUpdateSettings({ ...settings, characterFocus: next });
  };

  const cycleLaneButtons = () => {
    sounds.playClick();
    const modes: ('auto' | 'always' | 'hidden')[] = ['auto', 'always', 'hidden'];
    const curIdx = modes.indexOf(settings.showLaneButtons);
    const next = modes[(curIdx + 1) % modes.length];
    onUpdateSettings({ ...settings, showLaneButtons: next });
  };

  const cycleTouchControls = () => {
    sounds.playClick();
    const modes: ('auto' | 'always' | 'hidden')[] = ['auto', 'always', 'hidden'];
    const curIdx = modes.indexOf(settings.onScreenControls);
    const next = modes[(curIdx + 1) % modes.length];
    onUpdateSettings({ ...settings, onScreenControls: next });
  };

  const selectLanguage = (next: Language) => {
    sounds.playClick();
    setLanguage(next);
    onUpdateSettings({ ...settings, language: next });
  };

  const handleConfirmReset = () => {
    sounds.playWhack();
    onResetProgress();
    setShowConfirmReset(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md select-none animate-fadeIn font-['Fredoka']">
      <div className="relative w-full max-w-lg flex flex-col bg-gradient-to-b from-[#2A1E14] via-[#1E1712] to-[#140F0C] border-3 border-[#F97316] shadow-[0_12px_36px_rgba(0,0,0,0.85)] rounded-3xl text-[#FFF8E7] overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 bg-[#19110B] border-b-2 border-[#F97316]/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-[#64748B] to-[#334155] text-white flex items-center justify-center border-2 border-white/40 rounded-2xl shadow-md">
              <Settings className="w-6 h-6 text-white animate-[spin_10s_linear_infinite]" />
            </div>
            <div>
              <h2 className="font-['Lilita_One'] text-xl sm:text-2xl font-bold text-[#FEF08A] tracking-wider">
                {t('GAME SETTINGS')}
              </h2>
              <span className="text-xs text-[#FED7AA] font-medium block">
                {t('Tune graphics, audio, camera & controls')}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            aria-label={t('Close')}
            className="w-9 h-9 flex items-center justify-center bg-[#EF4444] hover:bg-[#F87171] text-white border-2 border-white/40 shadow-md active:scale-95 rounded-2xl cursor-pointer transition-all"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {/* Language */}
          <div className="p-3.5 bg-[#25180E] rounded-2xl border border-white/10 space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="text-lg leading-none" aria-hidden="true">
                🌐
              </span>
              <div>
                <h4 className="font-['Lilita_One'] text-sm sm:text-base text-white">
                  {t('Language')}
                </h4>
                <p className="text-xs text-[#FED7AA]/70">
                  {t('English and Burmese are available. The choice is saved on this device.')}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('Game language')}>
              {LANGUAGES.map((option) => {
                const active = language === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectLanguage(option.id)}
                    aria-pressed={active}
                    className={`py-2.5 rounded-xl font-['Lilita_One'] text-sm border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      active
                        ? 'bg-[#F97316] text-white border-white/50 shadow-md'
                        : 'bg-[#160E08] text-[#FED7AA] border-white/15 hover:border-[#F59E0B]/60'
                    }`}
                  >
                    {active ? <Check className="w-4 h-4" /> : null}
                    <span className={option.id === 'my' ? "font-['Aka08']" : undefined}>
                      {option.nativeLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Leaderboard name */}
          <div className="p-3.5 bg-[#25180E] rounded-2xl border border-white/10 space-y-2.5">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-[#FBBF24] shrink-0" />
              <div>
                <h4 className="font-['Lilita_One'] text-sm sm:text-base text-white">
                  {t('Leaderboard Name')}
                </h4>
                <p className="text-xs text-[#FED7AA]/70">
                  {t('Shown on the global board. Auto-generated until you change it.')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameDraft}
                maxLength={MAX_PLAYER_NAME_LENGTH}
                aria-label={t('Leaderboard name')}
                onChange={(event) => {
                  setNameDraft(event.target.value);
                  setNameSaved(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    sounds.playClick();
                    commitName();
                  }
                }}
                onBlur={commitName}
                className="flex-1 min-w-0 px-3 py-2 bg-[#160E08] text-white font-['Lilita_One'] text-sm tracking-wide rounded-xl border-2 border-[#F59E0B]/40 focus:border-[#FBBF24] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  commitName();
                }}
                className="px-3 py-2 bg-[#F97316] hover:bg-[#FB923C] text-white font-['Lilita_One'] text-xs rounded-xl border border-white/40 shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {nameSaved ? <Check className="w-3.5 h-3.5" /> : null}
                {nameSaved ? t('SAVED') : t('SAVE')}
              </button>
            </div>
          </div>

          {/* Audio */}
          <div className="flex items-center justify-between p-3.5 bg-[#25180E] rounded-2xl border border-white/10">
            <div className="flex items-center gap-3">
              {settings.isMuted ? (
                <VolumeX className="w-6 h-6 text-red-400" />
              ) : (
                <Volume2 className="w-6 h-6 text-[#10B981]" />
              )}
              <div>
                <h4 className="font-['Lilita_One'] text-sm sm:text-base text-white">
                  {t('Audio & Arcade Synth Beat')}
                </h4>
                <p className="text-xs text-[#FED7AA]/70">
                  {t(settings.isMuted ? 'Muted' : 'Enabled (Zero-lag synth)')}
                </p>
              </div>
            </div>
            <button
              onClick={toggleSound}
              className={`px-3 py-1.5 rounded-xl font-['Lilita_One'] text-xs font-bold transition-all cursor-pointer border ${
                settings.isMuted
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : 'bg-[#10B981] text-white border-white/40 shadow-sm'
              }`}
            >
              {t(settings.isMuted ? 'MUTED' : 'ON')}
            </button>
          </div>

          {/* Camera Shake */}
          <div className="flex items-center justify-between p-3.5 bg-[#25180E] rounded-2xl border border-white/10">
            <div>
              <h4 className="font-['Lilita_One'] text-sm sm:text-base text-white">
                {t('Cartoon Impact Screen Shake')}
              </h4>
              <p className="text-xs text-[#FED7AA]/70">
                {t('Juicy hit-stop & rumble during critical tail slaps')}
              </p>
            </div>
            <button
              onClick={toggleShake}
              className={`px-3 py-1.5 rounded-xl font-['Lilita_One'] text-xs font-bold transition-all cursor-pointer border ${
                settings.cameraShake
                  ? 'bg-[#10B981] text-white border-white/40 shadow-sm'
                  : 'bg-white/10 text-white/50 border-white/10'
              }`}
            >
              {t(settings.cameraShake ? 'ENABLED' : 'OFF')}
            </button>
          </div>

          {/* Camera Focus */}
          <div className="flex items-center justify-between p-3.5 bg-[#25180E] rounded-2xl border border-white/10">
            <div>
              <h4 className="font-['Lilita_One'] text-sm sm:text-base text-white">
                {t('Camera Perspective')}
              </h4>
              <p className="text-xs text-[#FED7AA]/70">
                {t(
                  settings.characterFocus === 'classic'
                    ? 'Classic Arcade Overview'
                    : 'Close-Up Dino Action Cam'
                )}
              </p>
            </div>
            <button
              onClick={toggleFocus}
              className="px-3 py-1.5 bg-[#F97316] text-white border border-white/40 shadow-sm rounded-xl font-['Lilita_One'] text-xs font-bold cursor-pointer"
            >
              {settings.characterFocus === 'classic' ? 'CLASSIC' : 'CLOSE DINO'}
            </button>
          </div>

          {/* On-Screen Touch Joystick */}
          <div className="flex items-center justify-between p-3.5 bg-[#25180E] rounded-2xl border border-white/10">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-[#38BDF8]" />
              <div>
                <h4 className="font-['Lilita_One'] text-sm sm:text-base text-white">
                  {t('On-Screen Controls')}
                </h4>
                <p className="text-xs text-[#FED7AA]/70">
                  {t('Virtual joystick and action buttons')} ({settings.onScreenControls})
                </p>
              </div>
            </div>
            <button
              onClick={cycleTouchControls}
              className="px-3 py-1.5 bg-[#2A1E14] text-[#FBBF24] border border-[#F59E0B]/50 rounded-xl font-['Lilita_One'] text-xs font-bold cursor-pointer uppercase"
            >
              {settings.onScreenControls}
            </button>
          </div>

          {/* Lane Quick Buttons */}
          <div className="flex items-center justify-between p-3.5 bg-[#25180E] rounded-2xl border border-white/10">
            <div>
              <h4 className="font-['Lilita_One'] text-sm sm:text-base text-white">
                {t('Show Lane Buttons')}
              </h4>
              <p className="text-xs text-[#FED7AA]/70">
                {t('Left / Right arrow buttons on mobile HUD')} ({settings.showLaneButtons})
              </p>
            </div>
            <button
              onClick={cycleLaneButtons}
              className="px-3 py-1.5 bg-[#2A1E14] text-[#FBBF24] border border-[#F59E0B]/50 rounded-xl font-['Lilita_One'] text-xs font-bold cursor-pointer uppercase"
            >
              {settings.showLaneButtons}
            </button>
          </div>

          {/* Reset Save Data */}
          <div className="pt-2 border-t border-white/10">
            {!showConfirmReset ? (
              <button
                onClick={() => setShowConfirmReset(true)}
                className="w-full py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 font-['Lilita_One'] text-xs rounded-xl flex items-center justify-center gap-2 border border-red-500/30 cursor-pointer transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t('Reset Progress')}</span>
              </button>
            ) : (
              <div className="p-3 bg-red-950/70 border-2 border-red-500 rounded-xl text-center space-y-2">
                <p className="text-xs text-red-200 font-bold">
                  {t('Are you sure? This cannot be undone.')}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleConfirmReset}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-['Lilita_One'] text-xs rounded-lg cursor-pointer"
                  >
                    {t('YES, RESET EVERYTHING')}
                  </button>
                  <button
                    onClick={() => setShowConfirmReset(false)}
                    className="px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white font-['Lilita_One'] text-xs rounded-lg cursor-pointer"
                  >
                    {t('Cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#160E08] border-t border-white/10 text-center text-xs text-[#FED7AA]/80">
          Swiposaur 3D Dino Party Runner v1.1.4
        </div>
      </div>
    </div>
  );
};
