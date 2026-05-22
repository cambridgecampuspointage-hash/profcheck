# ProfCheck User Guide

Guide d'utilisation fonctionnel de l'application `ProfCheck`.

Ce document explique comment utiliser le système selon le rôle connecté :
- `admin`
- `teacher`
- `reception`

Il décrit aussi les workflows principaux :
- gestion des équipes
- planning
- pointage QR
- suivi réception
- suivi étudiants
- rapports et paiements

## 1. Vue d'ensemble

ProfCheck est une plateforme de gestion de centre qui couvre :
- le pointage des professeurs par QR code
- la gestion du planning des séances
- la gestion des réceptionnistes et de leur présence
- le suivi des étudiants, classes et paiements
- les rapports de présence et les estimations de paiement

## 2. Connexion et rôles

### 2.1 Connexion

Page : `/login`

Chaque utilisateur se connecte avec son adresse e-mail et son mot de passe.

Après connexion, la redirection dépend du rôle :
- `admin` : accès à l'administration
- `teacher` : accès à l'espace professeur
- `reception` : accès à l'espace réception

### 2.2 Rôles disponibles

#### Admin

Peut :
- gérer les professeurs
- gérer les réceptionnistes
- gérer les salles et centres
- gérer le planning
- suivre les pointages
- valider certaines actions manuellement
- consulter les rapports
- suivre les paiements

#### Teacher

Peut :
- voir son dashboard
- consulter son planning
- scanner un QR code pour démarrer ou terminer une séance
- voir sa session en cours
- consulter son historique
- faire des demandes de correction

#### Reception

Peut :
- accéder au tableau de bord réception
- afficher les QR codes des salles
- utiliser les pages liées au pointage réception

## 3. Parcours admin

Navigation principale admin :
- `/admin/dashboard`
- `/admin/teachers`
- `/dashboard/reception`
- `/reception/dashboard`
- `/admin/rooms`
- `/admin/students`
- `/admin/attendance`
- `/admin/planning`
- `/admin/reports`
- `/admin/payments`
- `/admin/settings`

### 3.1 Tableau de bord admin

Page : `/admin/dashboard`

Permet de suivre :
- la journée en cours
- la semaine
- le mois
- les alertes
- les KPI d'activité

Usage recommandé :
1. Vérifier les alertes en haut de dashboard.
2. Contrôler les séances prévues versus les séances réellement pointées.
3. Passer ensuite sur les modules spécialisés si une anomalie apparaît.

### 3.2 Gestion des professeurs

Page : `/admin/teachers`

Permet :
- créer un professeur
- modifier ses informations
- réinitialiser son mot de passe
- supprimer un professeur

Bonnes pratiques :
- toujours renseigner correctement le tarif horaire
- garder le statut cohérent (`active`, etc.)
- vérifier qu'un professeur supprimé n'a pas de séance critique à traiter

### 3.3 Suivi réception

Page : `/dashboard/reception`

Cette page sert au suivi RH des réceptionnistes.

Contenu actuel :
- KPIs du jour
- alertes prioritaires
- plannings de travail
- pointage du jour
- résumé du mois

Fonctions utiles :
- filtrer les cartes du jour par anomalies, absences, sorties manquantes
- voir les retards, pauses longues et absences du mois
- ouvrir le détail d'une réceptionniste dans le tableau mensuel pour voir :
  - les dates
  - les retards en minutes
  - les départs anticipés en minutes
  - les pauses longues
  - les sorties non pointées

### 3.4 Accueil réception admin

Page : `/reception/dashboard`

Permet à l'administration de basculer sur la vue réception pour :
- afficher les QR des salles
- voir les professeurs présents
- contrôler l'activité du jour

### 3.5 Gestion des salles

Page : `/admin/rooms`

Permet :
- créer une salle
- modifier une salle
- supprimer une salle
- associer la salle à un centre

Les QR de pointage sont liés aux salles.

### 3.6 Gestion des étudiants

Page : `/admin/students`

Permet :
- créer une classe
- modifier une classe
- créer un étudiant
- modifier un étudiant
- bloquer ou autoriser l'accès étudiant
- générer des QR check-in élève par classe
- enregistrer un paiement
- supprimer un enregistrement de paiement

Usage recommandé :
1. Créer les classes.
2. Affecter les étudiants.
3. Suivre les paiements.
4. Générer les QR si nécessaire.

### 3.7 Pointages admin

Page : `/admin/attendance`

Permet :
- consulter les sessions de pointage professeurs
- voir les demandes de correction
- fermer manuellement une session
- supprimer une session si nécessaire
- valider ou rejeter une correction

Quand utiliser cette page :
- si un professeur a pointé de manière incorrecte
- si une session est restée active
- si une correction doit être traitée

### 3.8 Planning admin

Page : `/admin/planning`

Le planning permet :
- générer une semaine depuis les templates
- gérer les templates récurrents
- modifier un créneau
- annuler un créneau
- supprimer un créneau
- marquer manuellement une séance comme complétée

#### 3.8.1 Templates

Un template représente un créneau récurrent :
- jour
- heure
- durée
- professeur
- salle
- type
- public
- groupe

Workflow :
1. Créer les templates.
2. Générer la semaine.
3. Ajuster les cas particuliers avec les overrides.

#### 3.8.2 Marquer une séance comme complétée

Si un professeur a réellement assuré une séance mais n'a pas pointé via QR :

1. Aller dans `/admin/planning`.
2. Repérer la séance en statut `Prévu`.
3. Cliquer sur `Compléter`.
4. Saisir le motif.

Effet système :
- une `attendance_session` manuelle est créée
- la séance planifiée est liée à cette session
- le statut passe à `completed`
- la séance peut remonter dans les rapports

Important :
- à utiliser seulement si la séance a vraiment eu lieu
- le motif doit être explicite

### 3.9 Rapports

Page : `/admin/reports`

Permet de consulter les synthèses d'activité et les rapports par professeur.

Le système peut produire :
- des rapports de présence
- des estimations de paiement
- des exports PDF selon le module

### 3.10 Paiements

Page : `/admin/payments`

Permet de suivre les paiements liés aux professeurs ou aux étudiants selon la configuration actuelle des écrans.

À utiliser pour :
- contrôler les montants
- croiser avec les séances validées
- vérifier les périodes couvertes

### 3.11 Paramètres

Page : `/admin/settings`

Permet de configurer certains réglages globaux.

Selon la configuration du projet, cela peut inclure :
- fermeture automatique de sessions
- réglages du centre
- options de comportement global

## 4. Parcours professeur

Navigation principale professeur :
- `/teacher/dashboard`
- `/teacher/planning`
- `/teacher/scan`
- `/teacher/current-session`
- `/teacher/history`
- `/teacher/profile`

### 4.1 Dashboard professeur

Page : `/teacher/dashboard`

Permet de voir :
- l'activité du jour
- les badges
- le résumé personnel

### 4.2 Mon planning

Page : `/teacher/planning`

Permet de consulter les séances prévues.

Le professeur doit vérifier :
- l'heure
- la salle
- le groupe
- le type de séance

### 4.3 Scanner QR

Page : `/teacher/scan`

Le QR sert à :
- démarrer une séance
- terminer une séance

Le pointage prend en compte :
- le QR de salle
- la géolocalisation
- la signature
- la durée prévue

### 4.4 Session en cours

Page : `/teacher/current-session`

Permet au professeur de voir :
- si une séance est active
- quand elle a commencé
- son état actuel

### 4.5 Historique

Page : `/teacher/history`

Permet de revoir :
- les séances passées
- les durées
- les statuts

### 4.6 Mon rapport

Page : `/dashboard/mon-rapport`

Permet d'avoir une lecture plus analytique :
- heures
- ponctualité
- progression du mois
- prochaines séances

### 4.7 Corrections

Quand un pointage est manqué ou erroné, le professeur peut faire une demande de correction.

L'admin la traite ensuite dans le module pointage.

## 5. Parcours réception

Navigation principale réception :
- `/reception/dashboard`
- `/pointage-reception`

### 5.1 Tableau de bord réception

Page : `/reception/dashboard`

Permet :
- d'afficher rapidement les QR codes des salles
- de voir les professeurs présents
- de piloter l'activité d'accueil

### 5.2 Pointage réception

Page : `/pointage-reception`

Cette partie est destinée au suivi spécifique de la présence réception selon le workflow métier en place.

### 5.3 QR display

Pages :
- `/reception/qr-display/[roomId]`
- `/admin/qr-display/[roomId]`

Permettent d'afficher le QR code de la salle pour les professeurs.

## 6. Workflow de pointage professeur

### Démarrage d'une séance

1. Le professeur ouvre la page de scan.
2. Il scanne le QR de la salle.
3. Le système vérifie :
   - le token QR
   - la validité
   - la zone GPS
   - la signature
4. Une session de présence est créée.
5. Si une séance planifiée correspond, elle est liée automatiquement.

### Fin d'une séance

1. Le professeur rescannne le QR.
2. Le système clôture la session active.
3. La durée est calculée.
4. La séance planifiée passe en `completed`.

### Cas d'échec

Le pointage peut être refusé si :
- QR expiré
- hors zone GPS
- signature absente
- durée invalide
- session déjà active

## 7. Workflow planning

### Générer une semaine

1. Créer les templates.
2. Aller dans le planning semaine.
3. Cliquer sur `Générer la semaine`.

### Modifier une séance

1. Cliquer sur `Modifier`.
2. Ajuster les champs nécessaires.
3. Enregistrer.

### Annuler une séance

1. Cliquer sur `Annuler`.
2. Saisir un motif.
3. La séance passe en `cancelled`.

### Valider manuellement une séance faite sans pointage

1. Cliquer sur `Compléter`.
2. Entrer le motif.
3. La séance passe en `completed` avec session manuelle liée.

## 8. Workflow suivi réception

### Consulter la journée

1. Ouvrir `/dashboard/reception`.
2. Lire les KPIs.
3. Contrôler les alertes prioritaires.
4. Filtrer les cartes si besoin.

### Analyser le mois

1. Descendre vers `Résumé du mois`.
2. Cliquer sur une réceptionniste.
3. Lire le détail des anomalies :
   - dates
   - minutes
   - type d'anomalie

## 9. Workflow étudiants

### Créer une classe

1. Aller dans `/admin/students`.
2. Créer une classe.
3. Lui associer un enseignant si nécessaire.

### Ajouter un étudiant

1. Créer la fiche étudiant.
2. Vérifier son statut.
3. Gérer son accès si besoin.

### Enregistrer un paiement

1. Ouvrir l'étudiant.
2. Ajouter un paiement.
3. Vérifier la prochaine échéance.

### Pointage étudiant

Le système permet aussi un check-in étudiant par token / QR selon les pages :
- `/student/check-in/[token]`
- `/api/student-checkin/[token]`

## 10. Alertes et Telegram

Le système contient déjà :
- un module Telegram
- des routes d'alertes
- un historique d'envoi

Page :
- `/dashboard/parametres/telegram`

Utilité :
- activer la supervision
- suivre les alertes automatiques
- vérifier la connexion Telegram

## 11. Bonnes pratiques d'utilisation

### Admin

- ne pas valider manuellement une séance sans vérification
- utiliser des motifs précis
- traiter les demandes de correction régulièrement
- surveiller les sorties non pointées et les retards

### Teacher

- scanner le QR au début et à la fin
- vérifier la salle avant scan
- signaler rapidement les erreurs

### Reception

- afficher le bon QR de salle
- aider les professeurs en cas de problème de pointage
- remonter les anomalies à l'admin

## 12. Cas fréquents

### Un professeur a donné sa séance mais n'a pas pointé

Solution :
- aller dans `/admin/planning`
- cliquer sur `Compléter`
- saisir un motif

### Une séance est restée active

Solution :
- aller dans `/admin/attendance`
- fermer manuellement la session

### Une réceptionniste a plusieurs retards dans le mois

Solution :
- aller dans `/dashboard/reception`
- ouvrir le résumé mensuel
- cliquer sur la ligne de la réceptionniste
- consulter les dates et minutes exactes

### Un étudiant doit être bloqué

Solution :
- aller dans `/admin/students`
- modifier son accès en `blocked`
- ajouter le motif

## 13. Limites et vigilance

- Une validation manuelle admin doit rester exceptionnelle.
- Les données GPS manuelles créées par admin ne remplacent pas un vrai scan QR.
- Les suppressions de séances ou paiements doivent être réservées aux cas vérifiés.
- Les QR doivent être renouvelés et affichés dans la bonne salle.

## 14. Fichiers de référence

Pour l'équipe technique ou la reprise projet :
- [README.md](./README.md)
- [CLIENT_HANDOFF.md](./CLIENT_HANDOFF.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [supabase/SETUP.md](./supabase/SETUP.md)

## 15. Résumé rapide

### Admin

- pilote tout le centre
- gère planning, pointages, paiements, étudiants, réception

### Teacher

- consulte son planning
- pointe par QR
- suit ses séances et rapports

### Reception

- affiche les QR
- suit l'activité accueil
- aide sur le flux opérationnel quotidien
