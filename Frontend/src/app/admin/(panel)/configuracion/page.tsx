import {requireAdminSession} from '@/features/auth/session';
import {serverApi} from '@/lib/api/server';
import type {StoreInput} from '@/lib/contracts/admin-operations';
import {settingsInput} from '@/features/admin-operations/model';
import {SettingsEditor} from '@/features/admin-operations/settings-editor';
export default async function Settings(){await requireAdminSession();const initial=settingsInput(await serverApi<StoreInput>('admin/settings'));return <SettingsEditor initial={initial}/>;}
