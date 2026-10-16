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
| 3 | Login | Tap "Entrar com Google" with an invited account. Then open `/invite` and `/login` in the browser. | Home shows "Olá, <name>" and the button "Sair". `/invite` and `/login` open Home. |
| 4 | Favicon | Look at the browser tab and the tab switcher, once in light mode and once in dark mode. | The icon is a green square with a white division sign. It is clear on the light and on the dark tab bar. |
| 5 | Add to home screen | iPhone: Share, then "Adicionar à Tela de Início". Android: menu, then "Instalar app" or "Adicionar à tela inicial". | The home screen shows the green icon with the name "dividesperto". |
| 6 | Home screen app | Open the app from the home screen. Log in if it asks. | The app opens without the browser address bar. Google login brings you back into the app. |
| 7 | Bottom navigation | Open Home, a group and "Saldos gerais". | "Grupos" and "Saldos gerais" stay at the bottom of every logged-in page, above the home indicator or gesture bar. The current item is dark. |
| 8 | New group | Tap "Novo grupo", type a name, tap "Criar grupo". | The group opens with you as the only member. The Despesas tab shows the empty state "Nenhuma despesa ainda." |
| 9 | Members | Open the menu "⋯", then "Membros". Tap "Adicionar" next to the friend. | The friend appears in "Membros do grupo" and in the avatars under the group name. |
| 10 | Money input | Tap "Nova despesa", then tap "Valor". Type `123456`. Tap backspace once. Then clear the field, copy `R$ 1.234,56` from a note and paste it into the field. | The keyboard shows only digits, with no comma key. While you type, the field shows "0,01", "0,12", "1,23", "12,34", "123,45" and "1.234,56". Backspace shows "123,45". An empty field shows the grey "0,00". The paste shows "1.234,56". The page does not zoom. |
| 11 | Equal split and category | Tap "Categoria" and choose "Alimentação". Save an expense of R$ 100,01 split "Igual" between the two accounts. Then open it and tap "Editar". | The category list opens on the first tap and closes on the chosen item. One share is R$ 50,01 and the other share is R$ 50,00. The edit form shows "Alimentação". |
| 12 | Other splits | Try "Valores", "Porcentagem" and "Partes". | The preview "Quanto cada um paga" updates as you type. A wrong sum shows a message in Portuguese. |
| 13 | Items | Choose "Itens". Add "Pizza" R$ 60,00 for A and B, and "Vinho" R$ 40,00 for B. Set the total to R$ 110,00. | A pays R$ 33,00 and B pays R$ 77,00. |
| 14 | Edit and loading state | Open an expense, tap "Editar", change the value, tap "Salvar despesa". Then tap "Editar" again. | Grey placeholder blocks show while the page loads. The page body is never blank. The new value shows. The second edit form shows the new value. |
| 15 | Delete expense | Open an expense, tap "Excluir despesa", then "Sim, excluir". | The expense leaves the list. The Atividade tab shows the deletion. |
| 16 | Saldos tab | Open the Saldos tab of the group. | Each member shows "recebe" in green, "deve" in red or "em dia". "Sugestão de acerto" lists the transfers. |
| 17 | One-tap payment | Tap "Marcar como pago" on a transfer. | The transfer leaves the list. The payment shows under "Pagamentos". |
| 18 | Stale tap and error toast | Open the Saldos tab on both phones. Tap "Marcar como pago" on phone 1, then on phone 2 without a refresh. | Phone 2 shows a red message "Os saldos mudaram. Atualize a página." above the bottom navigation. The message closes with "✕" or after about 6 seconds. |
| 19 | Manual payment | Tap "Registrar pagamento", fill the form, save. Then edit it, save and tap "Editar" again. Then delete it. | The payment shows, changes and leaves the list. The second edit form shows the changed value. The nets change each time. |
| 20 | Activity | Open the Atividade tab. | Each change shows who made it, with the old and new values. |
| 21 | Overall balances | Open a group. Tap "Saldos gerais" in the bottom navigation, then tap the back arrow "←". | The page shows the sum per person across groups, with one line per group. The back arrow goes back to the group. |
| 22 | Archive | Open the menu "⋯", tap "Arquivar grupo". Go to Home. Then unarchive the group. | The archived group is read-only and moves to "Grupos arquivados". After "Desarquivar grupo" it is active again. |
| 23 | Empty states | Create a new group. Open its Despesas and Saldos tabs. | "Nenhuma despesa ainda." and "Nenhum pagamento ainda." show in dashed boxes with a short hint in Portuguese. |
| 24 | Layout | Scroll a long list. Open "Nova despesa" and "Registrar pagamento" and tap "Data". Turn the phone to landscape. | No page scrolls sideways. "Data" ends inside the screen next to "Valor" and opens the date picker without a zoom. "Nova despesa" and "Registrar pagamento" stay above the bottom navigation. No content hides behind the notch or the rounded corners. |
| 25 | Logout | On Home, tap "Sair". | The app goes to `/login`. `/login` has no navigation. |

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
- [ ] 11 Equal split and category
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
- [ ] 11 Equal split and category
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
