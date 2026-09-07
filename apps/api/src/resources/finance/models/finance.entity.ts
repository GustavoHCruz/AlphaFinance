import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn, Index } from 'typeorm';

export type EntryKind = 'income' | 'expense' | 'bill' | 'investment';
@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ default: '#c49b45' }) color: string;
  @Column() type: 'category' | 'label';
  @Column() kind: EntryKind;
  @Column('int', { default: 0 }) position: number;
}
@Entity('recurrences')
export class Recurrence {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() description: string;
  @Column() kind: EntryKind;
  @Column('int') amount: number;
  @Column('int') day: number;
  @Column() startMonth: string;
  @Column({ type: 'varchar', nullable: true }) endMonth: string | null;
  @Column({ type: 'uuid', nullable: true }) categoryId: string | null;
  @Column('jsonb', { default: [] }) labelIds: string[];
  @Column({ default: 'pix' }) method: string;
  @Column('int', { nullable: true }) percentageBps: number | null;
  @Column({ type: 'uuid', nullable: true }) incomeCategoryId: string | null;
}
@Entity('entries')
@Index(['recurrenceId', 'month'], { unique: true })
export class Entry {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() description: string;
  @Column() kind: EntryKind;
  @Column('int') amount: number;
  @Column('date') date: string;
  @Column() month: string;
  @Column({ default: false }) done: boolean;
  @Column({ type: 'uuid', nullable: true }) categoryId: string | null;
  @Column('jsonb', { default: [] }) labelIds: string[];
  @Column({ default: 'pix' }) method: string;
  @Column({ type: 'uuid', nullable: true }) recurrenceId: string | null;
  @Column({ default: false }) deleted: boolean;
  @Column('int', { nullable: true }) percentageBps: number | null;
  @Column({ type: 'uuid', nullable: true }) incomeCategoryId: string | null;
  @Column({ default: false }) estimated: boolean;
  @Column({ default: false }) isCarryover: boolean;
  @Column('int', { nullable: true }) expectedAmount: number | null;
  @Column('int', { nullable: true }) paidAmount: number | null;
}
@Entity('month_settings')
export class MonthSettings {
  @PrimaryColumn() month: string;
  @Column({ default: false }) carryover: boolean;
}
@Entity('profiles')
export class Profile {
  @PrimaryColumn('int') id: number;
  @Column({ default: 'pt-BR' }) locale: string;
  @Column({ default: 'BRL' }) currency: string;
}
