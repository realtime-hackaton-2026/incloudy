/*
 * frontend/src/avatar/AvatarPicker.tsx // choose the character that
 * represents you in the app. Purely presentational over useAvatar — the
 * caller owns where the choice comes from and goes.
 */

import { AVATARS } from './catalog'
import styles from './AvatarPicker.module.css'

export interface AvatarPickerProps {
  avatarId: string
  onSelect: (id: string) => void
}

export function AvatarPicker({ avatarId, onSelect }: AvatarPickerProps) {
  return (
    <div className={styles.picker} data-testid="avatar-picker">
      <span className={styles.label}>Tu avatar</span>
      <ul className={styles.strip} role="radiogroup" aria-label="Elegir avatar">
        {AVATARS.map((avatar) => {
          const selected = avatar.id === avatarId
          return (
            <li key={avatar.id} className={styles.option}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                data-state={selected ? 'selected' : 'idle'}
                className={styles.button}
                onClick={() => onSelect(avatar.id)}
              >
                <img className={styles.thumb} src={avatar.src} alt="" />
                <span className={styles.name}>{avatar.name}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
