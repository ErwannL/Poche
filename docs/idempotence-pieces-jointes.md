# Idempotence des pièces jointes — question ouverte

> À trancher lors de l'intégration avec le vrai Orqea.

## Le problème

L'idempotence de `createCard` est garantie par le `clientId` de la capture. Mais une capture peut avoir
plusieurs pièces jointes, envoyées **après** la création de la carte. Si la réponse d'un upload se perd
(coupure réseau pendant la réponse), Poche ne sait pas si le fichier a été enregistré : sans précaution,
la relance créerait un doublon de la pièce jointe.

## Ce que fait Poche aujourd'hui

1. L'`id` de la carte Orqea est enregistré localement **dès** sa création : une relance ne recrée jamais la
   carte, elle reprend aux pièces jointes.
2. Chaque pièce jointe porte un UUID local ; une pièce jointe marquée envoyée (`uploadedUrl`) n'est jamais renvoyée.
3. Chaque upload envoie l'en-tête `Idempotency-Key: <UUID de la pièce jointe>`
   (`uploadAttachment(cardId, file, { clientId })`).
4. Le mock déduplique sur `(cardId, Idempotency-Key)` : même clé → 200 avec la même `url`.

Reste une fenêtre de doublon **seulement si Orqea ignore l'en-tête** et que la réponse d'un upload se perd.

## Options côté Orqea

| Option                                                               | Description                                         | Pour                                                     | Contre                                                       |
| -------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| A. `Idempotency-Key` sur l'upload _(implémentée côté Poche et mock)_ | unicité `(cardId, clé)`, 200 + même `url` si rejoué | simple, standard, aucun changement de contrat de réponse | stocker la clé (TTL possible, ex. 24 h)                      |
| B. `clientId` dans le multipart                                      | même chose, via un champ de formulaire              | pas d'en-tête personnalisé (CORS)                        | moins standard                                               |
| C. Hash du contenu                                                   | dédup par `(cardId, sha256)`                        | aucun identifiant client                                 | deux photos identiques volontaires fusionnées ; coût du hash |
| D. Pièces jointes dans `createCard`                                  | un seul appel multipart avec la carte               | idempotence d'un bloc via `clientId`                     | gros corps, pas de reprise partielle, contrat plus lourd     |
| E. Accepter les doublons                                             | rien à faire                                        | —                                                        | doublons rares mais visibles                                 |

**Recommandation provisoire : A.** Aucun changement côté Poche n'est nécessaire si Orqea l'adopte ; pour B,
seul `src/orqea/httpClient.ts` change.

## Décision (Orqea, sept. 2026)

- [x] **Option A retenue et implémentée côté Orqea** : unicité `(utilisateur, carte, Idempotency-Key)`,
      `201` au premier envoi, `200` + la même `url` au rejeu. Aucun changement de contrat pour Poche.
- [x] **Taille maximale : 10 Mo** (au-delà : `413`, message « fichier trop volumineux »). Types : toute image
      décodable (le format DÉCODÉ décide de l'extension, jamais SVG) et l'audio `webm`/`mp4` ; le reste
      répond `400 UNSUPPORTED_MEDIA`.
- [x] **Affichage sur la carte** : Orqea n'a pas de zone « pièces jointes ». Une **image** est ajoutée à la
      description en `<img src="/uploads/…">` (comme un collage dans l'éditeur) ; un mémo vocal en lien.
- [ ] Durée de conservation des clés côté Orqea : non bornée pour l'instant.
- [ ] `GET /cards/:id/attachments` : non exposé.
