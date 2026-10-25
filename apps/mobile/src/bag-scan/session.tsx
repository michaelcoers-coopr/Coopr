import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { subscribeDevice } from '../device-store';
import { cropClubhead } from './crop';
import { copyClubPhoto } from './photos';
import { readScanClubs, readStoredFit, writeScanClubs, writeStoredFit } from './persist';
import { clubToDraft, draftToClub, placeClub, withInPlay, withoutClub } from './logic';
import { stubVision, type ClubVisionRead } from './vision';
import { clearHeldDraft, readHeldDraft } from './play-note';
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
  removeClub: (id: string) => void;
  setInPlay: (id: string, inPlay: boolean) => void;
  keepFacePhoto: (uri: string) => Promise<boolean>;
  attachPhoto: (uri: string, step: CaptureStep) => void;
  clearPhoto: () => void;
  saveFit: (fit: StoredFit) => void;
  saveDraft: (ack: 'kept_anyway' | null) => ScanClub | null;
}

const BagScanContext = createContext<BagScanValue | null>(null);

export function BagScanProvider({ children }: { children: ReactNode }) {
  const [clubs, setClubs] = useState<ScanClub[]>(() => readScanClubs());
  const [fit, setFit] = useState<StoredFit>(() => readStoredFit());
  const [draft, setDraft] = useState<ScanDraft>(() => readHeldDraft() ?? blankDraft());
  const [focus, setFocus] = useState<Focus>({ kind: 'draft' });
  const [sampleProfile, setSampleProfile] = useState<'A' | 'B'>('A');
  const [read, setRead] = useState<ClubVisionRead>(() => stubVision.read(null));
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const pull = () => {
      const nextClubs = readScanClubs();
      const nextFit = readStoredFit();
      setClubs((current) => (JSON.stringify(current) === JSON.stringify(nextClubs) ? current : nextClubs));
      setFit((current) => (JSON.stringify(current) === JSON.stringify(nextFit) ? current : nextFit));
    };
    pull();
    return subscribeDevice(pull);
  }, []);

  const value = useMemo<BagScanValue>(() => {
    const saveDraft = (ack: 'kept_anyway' | null) => {
      if (focus.kind === 'sample') return null;
      const club = draftToClub(draft, ack);
      const next = placeClub(clubs, club);
      setClubs(next);
      writeScanClubs(next);
      setFocus({ kind: 'saved', id: club.id });
      clearHeldDraft();
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
        clearHeldDraft();
        setDraft(blankDraft());
        setFocus({ kind: 'draft' });
        setRead(stubVision.read(null));
        setCameraNote(null);
      },
      editClub: (club) => {
        setDraft(clubToDraft(club));
        setFocus({ kind: 'draft' });
      },
      openSaved: (id) => setFocus({ kind: 'saved', id }),
      openSample: (id) => setFocus({ kind: 'sample', id }),
      removeClub: (id) => {
        const next = withoutClub(clubs, id);
        setClubs(next);
        writeScanClubs(next);
        setFocus({ kind: 'draft' });
        setDraft(blankDraft());
      },
      setInPlay: (id, inPlay) => {
        const result = withInPlay(clubs, id, inPlay);
        setNotice(result.refused);
        setClubs(result.clubs);
        writeScanClubs(result.clubs);
      },
      keepFacePhoto: async (uri) => {
        const cropped = await cropClubhead(uri);
        const source = cropped ?? uri;
        const id = draft.existingId ?? `scan-${Date.now().toString(36)}`;
        const copied = await copyClubPhoto(source, id);
        const kept = Boolean(cropped && copied);
        setDraft((current) => ({
          ...current,
          facePhotoUri: kept ? copied : null,
          captureUri: kept ? copied : current.captureUri,
          faceCropped: kept,
        }));
        if (!kept) setCameraNote('Could not crop on this device. The whole photo stays off the club card, and the render is used.');
        else setCameraNote(null);
        return kept;
      },
      attachPhoto: (uri, step) => {
        setDraft((current) => ({
          ...current,
          step,
          captureUri: uri,
          facePhotoUri: step === 'face' ? null : current.facePhotoUri,
          faceCropped: step === 'face' ? false : current.faceCropped,
        }));
        setRead(stubVision.read(uri));
      },
      clearPhoto: () => {
        setDraft((current) => ({ ...current, facePhotoUri: null, captureUri: null, faceCropped: false }));
        setRead(stubVision.read(null));
      },
      saveFit: (next) => {
        setFit(next);
        writeStoredFit(next);
      },
      saveDraft,
    };
  }, [cameraNote, clubs, draft, fit, focus, notice, read, sampleProfile]);

  return <BagScanContext.Provider value={value}>{children}</BagScanContext.Provider>;
}

export function useBagScan(): BagScanValue {
  const value = useContext(BagScanContext);
  if (!value) throw new Error('Bag scan screens render inside the bag layout.');
  return value;
}
