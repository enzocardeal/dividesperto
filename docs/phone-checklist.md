# Phone checklist

Do this walkthrough on two real phones before you call a release done. Use an iPhone with Safari and an Android phone with Chrome.

## Before you start

- Open the production URL: <https://dividesperto.vercel.app>.
- Use two invited Google accounts, one on each phone. Some flows need both phones.
- Keep one Google account that has no invite for flow 1.
- Each invite uses one of the 10 slots in `invited_emails`. Do flow 2 only when a new friend needs access.

## Flows

| # | Flow | Steps | Expected result |
|---|---|---|---|
| 1 | Refused login | On `/login`, tap "Entrar com Google" with the account that has no invite. | `/login` shows "Você precisa de um convite." and the link "Tenho um código de convite". |
| 2 | Invite (optional) | On `/invite`, type the code and the email of the new friend. Tap "Liberar acesso". | The page shows "Pronto. Agora entre com o Google usando este e-mail." |
| 3 | Login | Tap "Entrar com Google" with an invited account. | Home shows "Olá, <name>" and the button "Sair". |
| 4 | Favicon | Look at the browser tab and the tab switcher. | The icon is a dark square with a white division sign. |
| 5 | Add to home screen | iPhone: Share, then "Adicionar à Tela de Início". Android: menu, then "Instalar app" or "Adicionar à tela inicial". | The home screen shows the icon with the name "dividesperto". |
| 6 | Home screen app | Open the app from the home screen. Log in if it asks. | The app opens without the browser address bar. Google login brings you back into the app. |
| 7 | Bottom navigation | Open Home, a group and "Saldos gerais". Then open `/login` in the browser. | "Grupos" and "Saldos gerais" stay at the bottom of every logged-in page, above the home indicator or gesture bar. The current item is dark. `/login` has no navigation. |
| 8 | New group | Tap "Novo grupo", type a name, tap "Criar grupo". | The group opens with you as the only member. The Despesas tab shows the empty state "Nenhuma despesa ainda." |
| 9 | Members | Open the menu "⋯", then "Membros". Tap "Adicionar" next to the friend. | The friend appears in "Membros do grupo" and in the avatars under the group name. |
| 10 | Money input | Tap "Nova despesa", then tap "Valor". Type `1234.5`. | The keyboard shows digits and a decimal key. The field shows "1.234,5". The page does not zoom. |
| 11 | Equal split | Save an expense of R$ 100,01 split "Igual" between the two accounts. | One share is R$ 50,01 and the other share is R$ 50,00. |
| 12 | Other splits | Try "Valores", "Porcentagem" and "Partes". | The preview "Quanto cada um paga" updates as you type. A wrong sum shows a message in Portuguese. |
| 13 | Items | Choose "Itens". Add "Pizza" R$ 60,00 for A and B, and "Vinho" R$ 40,00 for B. Set the total to R$ 110,00. | A pays R$ 33,00 and B pays R$ 77,00. |
| 14 | Edit and loading state | Open an expense, tap "Editar", change the value, tap "Salvar despesa". | Grey placeholder blocks show while the page loads. The page body is never blank. The new value shows. |
| 15 | Delete expense | Open an expense, tap "Excluir despesa", then "Sim, excluir". | The expense leaves the list. The Atividade tab shows the deletion. |
| 16 | Saldos tab | Open the Saldos tab of the group. | Each member shows "recebe" in green, "deve" in red or "em dia". "Sugestão de acerto" lists the transfers. |
| 17 | One-tap payment | Tap "Marcar como pago" on a transfer. | The transfer leaves the list. The payment shows under "Pagamentos". |
| 18 | Stale tap and error toast | Open the Saldos tab on both phones. Tap "Marcar como pago" on phone 1, then on phone 2 without a refresh. | Phone 2 shows a red message "Os saldos mudaram. Atualize a página." above the bottom navigation. The message closes with "✕" or after about 6 seconds. |
| 19 | Manual payment | Tap "Registrar pagamento", fill the form, save. Then edit and delete it. | The payment shows, changes and leaves the list. The nets change each time. |
| 20 | Activity | Open the Atividade tab. | Each change shows who made it, with the old and new values. |
| 21 | Overall balances | Tap "Saldos gerais" in the bottom navigation. | The page shows the sum per person across groups, with one line per group. |
| 22 | Archive | Open the menu "⋯", tap "Arquivar grupo". Go to Home. Then unarchive the group. | The archived group is read-only and moves to "Grupos arquivados". After "Desarquivar grupo" it is active again. |
| 23 | Empty states | Create a new group. Open its Despesas and Saldos tabs. | "Nenhuma despesa ainda." and "Nenhum pagamento ainda." show in dashed boxes with a short hint in Portuguese. |
| 24 | Layout | Scroll a long list. Turn the phone to landscape. | No page scrolls sideways. "Nova despesa" and "Registrar pagamento" stay above the bottom navigation. No content hides behind the notch or the rounded corners. |
| 25 | Logout | On Home, tap "Sair". | The app goes to `/login`. |

## Results

Tick a flow only when the phone shows the expected result. Write each failure under Notes with the flow number.

### iOS Safari

Device and iOS version:

- [ ] 1 Refused login
- [ ] 2 Invite (optional)
- [ ] 3 Login
- [ ] 4 Favicon
- [ ] 5 Add to home screen
- [ ] 6 Home screen app
- [ ] 7 Bottom navigation
- [ ] 8 New group
- [ ] 9 Members
- [ ] 10 Money input
- [ ] 11 Equal split
- [ ] 12 Other splits
- [ ] 13 Items
- [ ] 14 Edit and loading state
- [ ] 15 Delete expense
- [ ] 16 Saldos tab
- [ ] 17 One-tap payment
- [ ] 18 Stale tap and error toast
- [ ] 19 Manual payment
- [ ] 20 Activity
- [ ] 21 Overall balances
- [ ] 22 Archive
- [ ] 23 Empty states
- [ ] 24 Layout
- [ ] 25 Logout

### Android Chrome

Device and Android version:

- [ ] 1 Refused login
- [ ] 2 Invite (optional)
- [ ] 3 Login
- [ ] 4 Favicon
- [ ] 5 Add to home screen
- [ ] 6 Home screen app
- [ ] 7 Bottom navigation
- [ ] 8 New group
- [ ] 9 Members
- [ ] 10 Money input
- [ ] 11 Equal split
- [ ] 12 Other splits
- [ ] 13 Items
- [ ] 14 Edit and loading state
- [ ] 15 Delete expense
- [ ] 16 Saldos tab
- [ ] 17 One-tap payment
- [ ] 18 Stale tap and error toast
- [ ] 19 Manual payment
- [ ] 20 Activity
- [ ] 21 Overall balances
- [ ] 22 Archive
- [ ] 23 Empty states
- [ ] 24 Layout
- [ ] 25 Logout

### Notes

Date of the walkthrough:
