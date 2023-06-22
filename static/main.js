fetch( 'https://api.github.com/repos/SteamDatabase/ValveResourceFormat/releases?per_page=1' )
	.then( function( response )
	{
		return response.json();
	} )
	.then( function( response )
	{
		if( response.length )
		{
			response = response[ 0 ];

			const date = new Date( response.published_at );
			const year = date.getUTCFullYear();
			let month = date.getUTCMonth() + 1;
			let day = date.getUTCDate();

			if( month < 10 )
			{
				month = `0${month}`;
			}

			if( day < 10 )
			{
				day = `0${day}`;
			}

			const downloadContainer = document.querySelectorAll( '#js-download-all .list-group-item' );
			let zipCount = 0;

			for( const asset of response.assets )
			{
				if( asset.name === 'VRF.exe' )
				{
					const button = document.getElementById( 'js-download' );
					button.href = asset.browser_download_url;
					button.querySelector( 'span' ).textContent =
						`Download viewer v${response.tag_name} (${year}-${month}-${day})`;
				}
				else if( asset.name.startsWith( 'Decompiler-' ) && asset.name.endsWith( '.zip' ) )
				{
					if( zipCount >= downloadContainer.length )
					{
						console.error( 'Not enough group items to fit all zip files' );
						continue;
					}

					const link = downloadContainer[ zipCount++ ];
					link.href = asset.browser_download_url;
					link.textContent = 'Download CLI Decompiler for ' + asset.name.substring( 'Decompiler-'.length, asset.name.length - '.zip'.length );
				}
			}
		}
	} );
