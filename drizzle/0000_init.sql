CREATE TABLE `commits` (
	`sha` varchar(40) NOT NULL,
	`repo_id` bigint NOT NULL,
	`author_login` varchar(64),
	`message` text,
	`committed_at` int NOT NULL,
	`additions` int NOT NULL DEFAULT 0,
	`deletions` int NOT NULL DEFAULT 0,
	CONSTRAINT `commits_sha` PRIMARY KEY(`sha`)
);
--> statement-breakpoint
CREATE TABLE `issues` (
	`id` bigint NOT NULL,
	`repo_id` bigint NOT NULL,
	`number` int NOT NULL,
	`title` varchar(512),
	`body_excerpt` text,
	`author` varchar(64) NOT NULL,
	`state` enum('open','closed') NOT NULL,
	`created_at` int NOT NULL,
	`closed_at` int,
	CONSTRAINT `issues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pull_requests` (
	`id` bigint NOT NULL,
	`repo_id` bigint NOT NULL,
	`number` int NOT NULL,
	`title` varchar(512),
	`body_excerpt` text,
	`author` varchar(64) NOT NULL,
	`state` enum('open','merged','closed') NOT NULL,
	`created_at` int NOT NULL,
	`merged_at` int,
	`closed_at` int,
	`first_review_at` int,
	`additions` int NOT NULL DEFAULT 0,
	`deletions` int NOT NULL DEFAULT 0,
	CONSTRAINT `pull_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `repos` (
	`id` bigint NOT NULL,
	`name` varchar(255) NOT NULL,
	`default_branch` varchar(255) NOT NULL,
	`created_at` int NOT NULL,
	`archived` boolean NOT NULL DEFAULT false,
	CONSTRAINT `repos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` bigint NOT NULL,
	`pr_id` bigint NOT NULL,
	`reviewer` varchar(64) NOT NULL,
	`state` enum('approved','changes_requested','commented','dismissed') NOT NULL,
	`body_excerpt` text,
	`submitted_at` int NOT NULL,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`resource` varchar(64) NOT NULL,
	`repo_id` bigint NOT NULL,
	`last_cursor` text,
	`last_run_at` int NOT NULL DEFAULT 0,
	CONSTRAINT `sync_state_resource_repo_id_pk` PRIMARY KEY(`resource`,`repo_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`login` varchar(64) NOT NULL,
	`name` varchar(255),
	`avatar_url` varchar(500),
	CONSTRAINT `users_login` PRIMARY KEY(`login`)
);
--> statement-breakpoint
ALTER TABLE `commits` ADD CONSTRAINT `commits_repo_id_repos_id_fk` FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commits` ADD CONSTRAINT `commits_author_login_users_login_fk` FOREIGN KEY (`author_login`) REFERENCES `users`(`login`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `issues` ADD CONSTRAINT `issues_repo_id_repos_id_fk` FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `issues` ADD CONSTRAINT `issues_author_users_login_fk` FOREIGN KEY (`author`) REFERENCES `users`(`login`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD CONSTRAINT `pull_requests_repo_id_repos_id_fk` FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pull_requests` ADD CONSTRAINT `pull_requests_author_users_login_fk` FOREIGN KEY (`author`) REFERENCES `users`(`login`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_pr_id_pull_requests_id_fk` FOREIGN KEY (`pr_id`) REFERENCES `pull_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_reviewer_users_login_fk` FOREIGN KEY (`reviewer`) REFERENCES `users`(`login`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `commit_repo_committed_idx` ON `commits` (`repo_id`,`committed_at`);--> statement-breakpoint
CREATE INDEX `commit_author_committed_idx` ON `commits` (`author_login`,`committed_at`);--> statement-breakpoint
CREATE INDEX `issue_repo_number_idx` ON `issues` (`repo_id`,`number`);--> statement-breakpoint
CREATE INDEX `issue_created_idx` ON `issues` (`created_at`);--> statement-breakpoint
CREATE INDEX `pr_repo_number_idx` ON `pull_requests` (`repo_id`,`number`);--> statement-breakpoint
CREATE INDEX `pr_author_created_idx` ON `pull_requests` (`author`,`created_at`);--> statement-breakpoint
CREATE INDEX `pr_created_idx` ON `pull_requests` (`created_at`);--> statement-breakpoint
CREATE INDEX `pr_merged_idx` ON `pull_requests` (`merged_at`);--> statement-breakpoint
CREATE INDEX `review_pr_idx` ON `reviews` (`pr_id`);--> statement-breakpoint
CREATE INDEX `review_reviewer_submitted_idx` ON `reviews` (`reviewer`,`submitted_at`);