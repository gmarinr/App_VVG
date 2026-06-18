import { Component, Input } from '@angular/core';
import { User } from '../models/models';

// Avatar circular con las iniciales del usuario y su color.
@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <div
      class="avatar"
      [style.background]="user?.avatarColor || '#888'"
      [style.width.px]="size"
      [style.height.px]="size"
      [style.font-size.px]="size * 0.42"
    >
      {{ initials }}
    </div>
  `,
  styles: [
    `
      .avatar {
        border-radius: 50%;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        flex-shrink: 0;
        line-height: 1;
      }
    `,
  ],
})
export class AvatarComponent {
  @Input() user?: User | null;
  @Input() size = 40;

  get initials(): string {
    const name = this.user?.alias || this.user?.nombre || '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
}
