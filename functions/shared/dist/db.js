export var DbCollections;
(function (DbCollections) {
    DbCollections["permissions"] = "permissions";
    DbCollections["profiles"] = "profiles";
    DbCollections["stripeCheckoutSessions"] = "stripeCheckoutSessions";
})(DbCollections || (DbCollections = {}));
export function isProfileComplete(profile) {
    return !!(profile === null || profile === void 0 ? void 0 : profile.name);
}
//# sourceMappingURL=db.js.map