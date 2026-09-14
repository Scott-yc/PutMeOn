import DetailRow from './DetailRow';
import { useEffect, useRef } from 'react';
import type { Profile } from '../../domain/models';
export default function ContactDialog({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} aria-labelledby="contact-title">
      <button className="close secondary" onClick={onClose} aria-label="Close contact details">
        ×
      </button>
      <h2 id="contact-title">{profile.name}</h2>
      {profile.companyName && <p className="company-name">{profile.companyName}</p>}
      <p>{profile.trade}</p>
      <DetailRow icon="location">{profile.location}</DetailRow>
      <hr />
      <p className="contact-row">
        <span>{profile.phone}</span>
        <a className="button secondary" href={`tel:${profile.phone.replace(/\s/g, '')}`}>
          Call
        </a>
      </p>
      <p className="contact-row">
        <span>{profile.email}</span>
        <a className="button secondary" href={`mailto:${profile.email}`}>
          Email
        </a>
      </p>
    </dialog>
  );
}
