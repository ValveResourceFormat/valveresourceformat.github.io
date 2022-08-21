fetch( 'https://api.github.com/repos/SteamDatabase/ValveResourceFormat/releases' )
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

			const downloadContainer = document.getElementById( 'js-download-all' );

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
					const link = document.createElement( 'a' );
					link.className = 'list-group-item';
					link.href = asset.browser_download_url;
					link.textContent = 'Download CLI Decompiler for ' + asset.name.substring( 'Decompiler-'.length, asset.name.length - '.zip'.length );
					downloadContainer.prepend( link );
				}
			}
		}
	} );
