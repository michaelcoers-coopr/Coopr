import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { readScanClubs, readStoredFit, writeScanClubs, writeStoredFit } from './persist';
import { draftToClub, placeClub } from './logic';
import { stubVision, type ClubVisionRead } from './vision';
import { blankDraft, type CaptureStep, type Focus, type ScanClub, type ScanDraft, type StoredFit } from './types';

interface BagScanValue {
  clubs: ScanClub[];
  fit: StoredFit;
  draft: ScanDraft;
  focus: Focus;
  sampleProfile: 'A' | 'B';
  read: ClubVisionRead;
  cameraNote: string | null;
  notice: string | null;
  setSampleProfile: (profile: 'A' | 'B') => void;
  setCameraNote: (note: string | null) => void;
  setNotice: (notice: string | null) => void;
  setStep: (step: CaptureStep) => void;
  patch: (partial: Partial<ScanDraft>) => void;
  startNew: () => void;
  editClub: (club: ScanClub) => void;
  openSaved: (id: string) => void;
  openSample: (id: string) => void;
  attachPhoto: (uri: string, step: CaptureStep) => void;
  clearPhoto: () => void;
  saveFit: (fit: StoredFit) => void;
  saveDraft: (ack: 'kept_anyway' | null) => ScanClub | null;
}

const BagScanContext = createContext<BagScanValue | null>(null);

export function BagScanProvider({ children }: { children: ReactNode }) {
  const [clubs, setClubs] = useState<ScanClub[]>(() => readScanClubs());
  const [fit, setFit] = useState<StoredFit>(() => readStoredFit());
  const [draft, setDraft] = useState<ScanDraft>(() => blankDraft());
  const [focus, setFocus] = useState<Focus>({ kind: 'draft' });
  const [sampleProfile, setSampleProfile] = useState<'A' | 'B'>('A');
  const [read, setRead] = useState<ClubVisionRead>(() => stubVision.read(null));
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const value = useMemo<BagScanValue>(() => {
    const saveDraft = (ack: 'kept_anyway' | null) => {
      if (focus.kind === 'sample') return null;
      const club = draftToClub(draft, ack);
      const next = placeClub(clubs, club);
      setClubs(next);
      writeScanClubs(next);
      setFocus({ kind: 'saved', id: club.id });
      return club;
    };
    return {
      clubs,
      fit,
      draft,
      focus,
      sampleProfile,
      read,
      cameraNote,
      notice,
      setSampleProfile,
      setCameraNote,
      setNotice,
      setStep: (step) => setDraft((current) => ({ ...current, step })),
      patch: (partial) => setDraft((current) => ({ ...current, ...partial })),
      startNew: () => {
        setDraft(blankDraft());
        setFocus({ kind: 'draft' });
        setRead(stubVision.read(null));
        setCameraNote(null);
      },
      editClub: (club) => {
        setDraft({
          step: 'face',
          facePhotoUri: club.photoUri,
          captureUri: club.photoUri,
          brand: club.brand ?? '',
          model: club.model ?? '',
          type: club.type,
          ironBuild: club.ironBuild,
          loftText: club.loft == null ? '' : String(club.loft),
          clubNumber: club.clubNumber ?? '',
          flex: club.flex,
          existingId: club.id,
        });
        setFocus({ kind: 'draft' });
      },
      openSaved: (id) => setFocus({ kind: 'saved', id }),
      openSample: (id) => setFocus({ kind: 'sample', id }),
      attachPhoto: (uri, step) => {
        setDraft((current) => ({
          ...current,
          step,
          captureUri: uri,
          facePhotoUri: step === 'face' ? uri : current.facePhotoUri,
        }));
        setRead(stubVision.read(uri));
      },
      clearPhoto: () => {
        setDraft((current) => ({ ...current, facePhotoUri: null, captureUri: null }));
        setRead(stubVision.read(null));
      },
      saveFit: (next) => {
        setFit(next);
        writeStoredFit(next);
      },
      saveDraft,
    };
  }, [cameraNote, clubs, draft, fit, focus.kind, notice, read, sampleProfile]);

  return <BagScanContext.Provider value={value}>{children}</BagScanContext.Provider>;
}

export function useBagScan(): BagScanValue {
  const value = useContext(BagScanContext);
  if (!value) throw new Error('Bag scan screens render inside the bag layout.');
  return value;
}
