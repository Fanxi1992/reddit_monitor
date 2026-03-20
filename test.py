from apify_client import ApifyClient

# Initialize the ApifyClient with your API token
client = ApifyClient("")

# Prepare the Actor input
run_input = {
    "startUrls": [{ "url": "https://www.reddit.com/r/DarkRomance/comments/1ry78r7/green_flag_court_is_officially_in_session_what/?share_id=z5ecLJURUWEEs5fqtX_f4&utm_content=1&utm_medium=ios_app&utm_name=ioscss&utm_source=share&utm_term=1" }, { "url": "https://www.reddit.com/r/chrome_extensions/comments/1r3uvy2/i_built_an_extension_that_overlays_live_odds_arb/?share_id=BFk1hxQ2yrEvcw8GzTeVT&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1" }, { "url": "https://www.reddit.com/r/buildapc/comments/1ry3sqb/nearly_cracked_a_pc_fan_shroud_with_an_18v_makita/" }, { "url": "https://www.reddit.com/r/championsleague/comments/1rxp095/what_exactly_makes_declan_rice_so_good_i_can_feel/" }, { "url": "https://www.reddit.com/r/SideProject/comments/1rqv0xp/i_was_losing_my_mind_tracking_polymarket_across_6/" }],
    "skipComments": True,
    "skipUserPosts": True,
    "skipCommunity": True,
    "ignoreStartUrls": False,
    "searchUsers": False,
    "sort": "new",
    "includeNSFW": True,
    "maxItems": 10,
    "maxPostCount": 10,
    "maxComments": 10,
    "maxCommunitiesCount": 2,
    "maxUserCount": 2,
    "scrollTimeout": 40,
    "proxy": {
        "useApifyProxy": True,
        "apifyProxyGroups": ["RESIDENTIAL"],
    },
    "debugMode": False,
}

# Run the Actor and wait for it to finish
run = client.actor("oAuCIx3ItNrs2okjQ").call(run_input=run_input)

# Fetch and print Actor results from the run's dataset (if there are any)
for item in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(item)