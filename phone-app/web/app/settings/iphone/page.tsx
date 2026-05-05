import { SetupClient } from './SetupClient';

export const metadata = {
  title: 'Setup on iPhone · PhoneApp',
};

export default function SetupOnIphonePage() {
  return (
    <main style={{ padding: '1.5rem', maxWidth: 720, margin: '0 auto' }}>
      <h1>Setup on iPhone</h1>
      <p>Three steps to capture flashcards from any iPhone app:</p>
      <ol style={{ paddingLeft: '1.25rem', lineHeight: 1.6 }}>
        <li>
          <strong>Install this app to your home screen.</strong> In Safari tap <em>Share</em> →{' '}
          <em>Add to Home Screen</em>. (Skip this on desktop.)
        </li>
        <li>
          <strong>Generate an API token below</strong> and copy it. You will only see the raw value
          once.
        </li>
        <li>
          <strong>Download the iOS Shortcut</strong>, open it, paste the token into the prompt, and
          save. Then share text from any app to flashcard it.
        </li>
      </ol>
      <SetupClient />
    </main>
  );
}
