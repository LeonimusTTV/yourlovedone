/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// import { Devs } from "@utils/constants";

import "./lovePlugin.css";

import { BadgePosition, ProfileBadge } from "@api/Badges";
import { ChatBarButton } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import { getCurrentChannel } from "@utils/discord";
import { Margins } from "@utils/margins";
import { closeModal, ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { findByCodeLazy, findByPropsLazy, findLazy } from "@webpack";
import { Forms, Heading, Text } from "@webpack/common";


const containerWrapper = findByPropsLazy("memberSinceWrapper");
const container = findByPropsLazy("memberSince");
const getCreatedAtDate = findByCodeLazy('month:"short",day:"numeric"');
const locale = findByPropsLazy("getLocale");
const section = findLazy((m: any) => m.section !== void 0 && m.heading !== void 0 && Object.values(m).length === 2);

const cl = classNameFactory("vc-st-");

// store the old badge name to delete it when edited
let oldBadge: ProfileBadge | null = null;

interface BirthdayMessage {
    message: string;
    imageUrl: string;
}

interface User {
    id: string;
    globalName: string;
    username: string;
}

const settings = definePluginSettings({
    addHearts: {
        type: OptionType.BOOLEAN,
        description: "Add a heart to the end of the name of the loved one and at the end of the 'Together Since' date",
        restartNeeded: true,
    },
    enableTogetherSince: {
        type: OptionType.BOOLEAN,
        description: "Enable the 'Together Since' feature",
        default: true,
    },
    yourLovedOneTextUsername: {
        type: OptionType.BOOLEAN,
        description: "Add '● Your Loved one' after the username",
        default: true,
    },
    addBadge: {
        type: OptionType.BOOLEAN,
        description: "Add a badge to the loved one",
        default: true,
        onChange: badge,
    },
    enableBirthdayButton: {
        type: OptionType.BOOLEAN,
        description: "Enable the birthday button",
        default: true,
        restartNeeded: true,
    },
    userId: {
        type: OptionType.STRING,
        description: "The user id of the user you love",
        placeholder: "The user you love",
        restartNeeded: true,
    },
    globalName: {
        type: OptionType.STRING,
        description: "The name of you loved one",
        default: "Baby :3",
        restartNeeded: true,
    },
    togetherSince: {
        type: OptionType.STRING,
        description: "The date when you and your loved one are together",
        placeholder: "2024-04-19",
        disabled: () => !settings.store.enableTogetherSince,
    },
    heart: {
        type: OptionType.SELECT,
        description: "The heart emoji you want to use",
        // default: "💖",
        options: [
            { label: "💖", value: "💖", default: true },
            { label: "❤️", value: "❤️" },
            { label: "💕", value: "💕" },
            { label: "💗", value: "💗" },
            { label: "💞", value: "💞" },
            { label: "💓", value: "💓" },
            { label: "💘", value: "💘" },
            { label: "💝", value: "💝" },
            { label: "💟", value: "💟" },
            { label: "❣️", value: "❣️" },
            { label: "💙", value: "💙" },
            { label: "💚", value: "💚" },
            { label: "💛", value: "💛" },
            { label: "💜", value: "💜" },
            { label: "🧡", value: "🧡" },
        ],
        disabled: () => !settings.store.addHearts,
    },
    badgeDescription: {
        type: OptionType.STRING,
        description: "The description of the badge",
        default: "Your Loved One",
        disabled: () => !settings.store.addBadge,
        onChange: badge,
    },
    badgeImage: {
        type: OptionType.STRING,
        description: "The image of the badge",
        default: "https://cdn.discordapp.com/emojis/1228785231801225347.webp?size=20&quality=lossless",
        disabled: () => !settings.store.addBadge,
        onChange: badge,
    },
    badgePosition: {
        type: OptionType.SELECT,
        description: "The position of the badge",
        options: [
            { label: "Start", value: BadgePosition.START, default: true },
            { label: "End", value: BadgePosition.END },
        ],
        disabled: () => !settings.store.addBadge,
        onChange: badge,
    },
    birthdayDate: {
        type: OptionType.STRING,
        description: "The birthday date of your loved one",
        placeholder: "2007-08-06",
        default: "2007-08-06",
        disabled: () => !settings.store.enableBirthdayButton,
    }
});

function notify(title: string, message: string) {
    Vencord.Api.Notifications.showNotification({
        title: title,
        body: message
    });
}

async function badge() {
    if (!settings.store.addBadge) return;

    if (!settings.store.userId) {
        notify("Error", "You need to set the user id of your loved one");
        return;
    }

    if (!settings.store.badgeDescription) {
        notify("Error", "You need to set the badge description");
        return;
    }

    if (!settings.store.badgeImage) {
        notify("Error", "You need to set the badge image");
        return;
    }

    // check if the image is valid
    try {
        await fetch(settings.store.badgeImage);
    } catch (e) {
        notify("Error", "The badge image is invalid");
        return;
    }

    if (oldBadge) {
        Vencord.Api.Badges.removeBadge(oldBadge);
    }

    const yourLovedOneBadge: ProfileBadge = {
        description: settings.store.badgeDescription,
        image: settings.store.badgeImage,
        position: settings.store.badgePosition,
        shouldShow: ({ userId }) => userId === settings.store.userId,
    };

    oldBadge = yourLovedOneBadge;

    Vencord.Api.Badges.addBadge(yourLovedOneBadge);
}

function getNextBirthdayMessage(birthday: string): BirthdayMessage {
    const currentDate = new Date();
    const [year, month, day] = birthday.split("-").map(Number);

    // Validate parsed date components
    if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
        return {
            message: "Invalid date format. Please provide a valid date in the format YYYY-MM-DD.",
            imageUrl: "https://media1.tenor.com/m/o5lM2pr5LNIAAAAC/no.gif"
        };
    }

    // Adjust current date to ignore time
    const currentDayMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

    // Adjust birthday date to ignore time
    const birthDateThisYear = new Date(currentDate.getFullYear(), month - 1, day);
    const birthDateNextYear = new Date(currentDate.getFullYear() + 1, month - 1, day);

    // Determine the next birthday
    const nextBirthday = birthDateThisYear >= currentDayMonth ? birthDateThisYear : birthDateNextYear;

    // Calculate the difference in time
    const diffTime = nextBirthday.getTime() - currentDayMonth.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);

    console.log(diffDays, diffMonths);

    if (diffDays === 0) {
        return {
            message: "Today it's the birthday of your loved one :3",
            imageUrl: "https://media.tenor.com/l2QU5JIn6q0AAAAi/happy-birthday.gif"
        };
    } else if (diffDays < 10) {
        return {
            message: `Less than ${diffDays} days, prepare the gift :P`,
            imageUrl: "https://i.pinimg.com/originals/22/9d/25/229d253bd81b1ef482dff736e648d2fc.gif"
        };
    } else if (diffDays < 30) {
        return {
            message: "In less than a month, be ready!",
            imageUrl: "https://media.tenor.com/cGzc08rXDCwAAAAi/cat.gif"
        };
    } else if (diffMonths < 6) {
        return {
            message: `In less than ${diffMonths} months, time flies!`,
            imageUrl: "https://media1.tenor.com/m/hsIK0WE7mQIAAAAd/cat-cat-blink.gif"
        };
    } else if (diffMonths < 12) {
        return {
            message: `In more than ${diffMonths} months, be patient :)`,
            imageUrl: "https://media1.tenor.com/m/LZ6_379s4bIAAAAC/catwait-waiting.gif"
        };
    } else {
        return {
            message: "Next year, prepare yourself well in advance!",
            imageUrl: "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnFob3Y2OTg4N25uMDRtbWx0c3l2ZjZqNnVjbXB6cG95Zm9xMWdjbSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/sthmCnCpfr8M8jtTQy/giphy.webp"
        };
    }
}

function BirthdayModal({ rootProps, close }: { rootProps: ModalProps, close(): void; }) {

    const birthdayMessage = getNextBirthdayMessage(settings.store.birthdayDate ?? "");

    return (
        <ModalRoot {...rootProps}>
            <ModalHeader className={cl("modal-header")}>
                <Forms.FormTitle tag="h2">
                    Birthday of Your Loved One 🍰
                </Forms.FormTitle>

                <ModalCloseButton onClick={close} />
            </ModalHeader>
            <ModalContent className={cl("modal-content")}>
                <Forms.FormText style={{ textAlign: "center" }} className={Margins.top16}>{birthdayMessage.message}</Forms.FormText>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: 10 }}>
                    <img src={birthdayMessage.imageUrl} alt="Birthday" style={{ width: 150, height: 150, alignSelf: "center" }} />
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

async function birthdayButton() {
    if (!settings.store.enableBirthdayButton) return;

    if (!settings.store.birthdayDate) {
        notify("Error", "You need to set the birthday date of your loved one");
        return;
    }

    Vencord.Api.ChatButtons.addChatBarButton("love", props => {
        return (
            <ChatBarButton
                tooltip="Tell you when your loved one's birthday is"
                onClick={() => {
                    const key = openModal(props => (
                        <BirthdayModal
                            rootProps={props}
                            close={() => closeModal(key)}
                        />
                    ));
                }}
            >
                🍰
            </ChatBarButton>
        );
    });
}

export default definePlugin({
    name: "YourLovedOne",
    description: "Make your love be special",
    authors: [{ name: "LeonimusT", id: 1196458978767544410n }],
    settings,

    patches: [
        {
            find: "i.jsx)(e,{...n,user:d,",
            replacement: {
                match: /...n,user:(d),/,
                replace: "user:$1=$self.modifyUserInfo($1),"
            }
        },
        {
            find: "className:s()(a,l.overflow),",
            replacement: {
                match: /className:\i\(\)\((\w+),\s*l\.overflow\)/,
                replace: "className:s()(a, $1=$self.changeClasses(l.overflow, d.current))"
            }
        },
        // thanks to the friendSince plugin for that
        {
            find: "action:\"PRESS_APP_CONNECTION\"",
            replacement: {
                match: /USER_PROFILE_MEMBER_SINCE,.{0,100}userId:(\i\.id),.{0,100}}\)}\),/,
                replace: "$&,$self.togetherSince({userId:$1,isSidebar:false}),"
            }
        },
        {
            find: ".PANEL}),nicknameIcons",
            replacement: {
                match: /USER_PROFILE_MEMBER_SINCE,.{0,100}userId:(\i\.id)}\)}\)/,
                replace: "$&,$self.togetherSince({userId:$1,isSidebar:false})"
            }
        },
    ],
    modifyUserInfo(user: User) {
        // console.log(user);
        if (!user || !user.id) return user;
        console.log(user);
        // Replace 'TARGET_USER_ID' with the actual user ID you want to target
        if (user.id === settings.store.userId) {
            user.globalName = settings.store.globalName + (settings.store.addHearts ? " " + settings.store.heart : "");

            if (settings.store.yourLovedOneTextUsername) {

                if (user.username.includes(" ● Your Loved one")) return user;

                user.username += " ● Your Loved one";
            }

            // console.log(user);
            return user;
        }
        return user;
    },
    changeClasses(classes: string, current: HTMLDivElement) {
        if (current === null) return classes;

        // console.log(current.current.innerText);

        if (current.innerText !== settings.store.globalName + (settings.store.addHearts ? " " + settings.store.heart : "")) {
            return classes;
        }

        current.innerHTML = settings.store.globalName + (settings.store.addHearts ? " <span>" + settings.store.heart + "</span>" : "");

        // console.log(classes);
        // console.log("CUTIE DETECTED!");
        classes = "rainbow-text-animated";
        return classes;
    },

    togetherSince: ErrorBoundary.wrap(({ userId, isSidebar }: { userId: string; isSidebar: boolean; }) => {

        if (!settings.store.enableTogetherSince) return null;

        if (userId !== settings.store.userId) return null;

        if (!settings.store.togetherSince) return null;

        return (
            <section className={section.section}>
                <Heading variant="text-xs/semibold" style={isSidebar ? {} : { color: "var(--header-secondary)" }}>
                    Together Since
                </Heading>

                {
                    isSidebar ? (
                        <Text variant="text-sm/normal">
                            {getCreatedAtDate(settings.store.togetherSince, locale.getLocale())}
                        </Text>
                    ) : (
                        <div className={containerWrapper.memberSinceWrapper}>
                            <div className={container.memberSince}>
                                {!!getCurrentChannel()?.guild_id && (
                                    <svg
                                        aria-hidden="true"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="var(--interactive-normal)"
                                    >
                                        <path d="M12 4.435c-1.989-5.399-12-4.597-12 3.568 0 4.068 3.06 9.481 12 14.997 8.94-5.516 12-10.929 12-14.997 0-8.118-10-8.999-12-3.568z" />
                                    </svg>
                                )}
                                <Text variant="text-sm/normal">
                                    {getCreatedAtDate(settings.store.togetherSince, locale.getLocale())} {settings.store.addHearts ? settings.store.heart : ""}
                                </Text>
                            </div>
                        </div>
                    )
                }

            </section>
        );
    }, { noop: true }),

    start() {
        badge();
        birthdayButton();
    }
});

/* Test Zone

// add buttons to do input bar
Vencord.Api.ChatButtons.addChatBarButton("love", props => {
    return (
        <ChatBarButton
            tooltip="Love"
            onClick={() => {
                console.log("I love you");
            }}
        >
            ❤️
        </ChatBarButton>
    );
});
*/
